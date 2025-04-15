// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

library ConsensusLib {
    enum Status {
        IDLE,
        VOTING,
        APPROVED,
        DENIED,
        SPENT,
        DELETED
    }

    enum Options {
        EMPTY,
        YES,
        NO,
        ABSTAINTION
    }

    enum Category {
        DECISION,
        SPENT,
        CHANGE_QUOTA,
        CHANGE_MANAGER
    }

    struct Topic {
        string title;
        string description;
        Status status;
        Category category;
        uint amount;
        address responsible;
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

    struct TopicUpdate {
        bytes32 topicId;
        string title;
        Status status;
        Category category;
    }

    struct TransferReceipt {
        address to;
        uint256 amount;
        string topic;
    }
}
