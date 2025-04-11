// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import {ConsensusLib as Lib} from "./ConsensusLib.sol";

interface IConsensus {
    function openVoting(string memory title) external;

    function vote(string memory title, Lib.Options _option) external;

    function closeVoting(string memory title) external;

    function addLeader(address leader, uint8 _groupId) external;

    function removeLeader(address leader, uint8 _groupId) external;

    function setManager(address newManager) external;

    function getManager() external view returns (address);

    function setCounselor(address counselor, bool _isEntering) external;

    function addTopic(
        string memory title,
        string memory _description,
        Lib.Category _category,
        uint amount,
        address responsible
    ) external;

    function removeTopic(string memory title) external;

    function numberOfVotes(string memory title) external view returns (uint256);
}
