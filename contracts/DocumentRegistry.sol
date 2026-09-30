// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract DocumentRegistry {
    struct Document {
        string ipfsCID;
        string source;
        uint256 timestamp;
        uint256 voteCount;
        bool confirmed;
    }

    address public owner;
    address[3] public registrars;
    mapping(bytes32 => Document) public documents;
    mapping(bytes32 => mapping(address => bool)) public hasVoted;

    event DocumentProposed(bytes32 indexed docHash, string ipfsCID, string source, address proposer);
    event DocumentConfirmed(bytes32 indexed docHash, uint256 confirmedAt);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    modifier onlyRegistrar() {
        require(isRegistrar(msg.sender), "Not an authorized registrar");
        _;
    }

    constructor(address _r1, address _r2, address _r3) {
        require(_r1 != _r2 && _r1 != _r3 && _r2 != _r3, "Registrars must be distinct");
        require(
            _r1 != msg.sender && _r2 != msg.sender && _r3 != msg.sender,
            "Owner cannot be a registrar"
        );
        owner = msg.sender;
        registrars = [_r1, _r2, _r3];
    }

    function isRegistrar(address addr) public view returns (bool) {
        return addr == registrars[0] || addr == registrars[1] || addr == registrars[2];
    }

    function proposeDocument(bytes32 docHash, string memory ipfsCID, string memory source) public onlyOwner {
        require(documents[docHash].timestamp == 0, "Document already proposed");

        documents[docHash] = Document({
            ipfsCID: ipfsCID,
            source: source,
            timestamp: block.timestamp,
            voteCount: 0,
            confirmed: false
        });

        emit DocumentProposed(docHash, ipfsCID, source, msg.sender);
    }

    function voteToConfirm(bytes32 docHash) public onlyRegistrar {
        require(documents[docHash].timestamp != 0, "Document not proposed yet");
        require(!hasVoted[docHash][msg.sender], "Already voted");
        require(!documents[docHash].confirmed, "Already confirmed");

        hasVoted[docHash][msg.sender] = true;
        documents[docHash].voteCount += 1;

        if (documents[docHash].voteCount >= 2) {
            documents[docHash].confirmed = true;
            emit DocumentConfirmed(docHash, block.timestamp);
        }
    }

    function verifyDocument(bytes32 docHash) public view returns (
        string memory ipfsCID,
        string memory source,
        uint256 timestamp,
        uint256 voteCount,
        bool confirmed
    ) {
        Document memory doc = documents[docHash];
        require(doc.timestamp != 0, "Document not found");
        return (doc.ipfsCID, doc.source, doc.timestamp, doc.voteCount, doc.confirmed);
    }
}
