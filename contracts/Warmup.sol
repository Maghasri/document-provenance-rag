// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Warmup {
    mapping(string => string) private store;

    event ValueSet(string key, string value);

    function set(string memory key, string memory value) public {
        store[key] = value;
        emit ValueSet(key, value);
    }

    function get(string memory key) public view returns (string memory) {
        return store[key];
    }
}
