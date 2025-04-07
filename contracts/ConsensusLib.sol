// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

library ConsensusLib {
    enum Status {
        IDLE,
        VOTING,
        APPROVED,
        DENIED
    }

    enum Options {
        EMPTY,
        YES,
        NO,
        ABSTAINTION
    }

    struct Topic {
        string title;
        string description;
        Status status;
        uint256 createdAt;
        uint256 startDate;
        uint256 endDate;
    }

    struct Vote {
        address leader;
        uint8 group;
        Options option;
        uint256 createdAt;
    }
}
