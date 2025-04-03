// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Consensus {
    address private _manager;
    mapping(uint8 => bool) private _groups;
    mapping(address => uint8) private _groupLeaders;
    mapping(address => bool) private _counselors;

    constructor() {
        _manager = msg.sender;

        for (uint8 i = 1; i <= 10; i++) {
            _groups[i] = true;
        }
    }

    function getManager() public view returns (address) {
        return _manager;
    }

    function ping() public pure returns (string memory) {
        return "pong";
    }
}
