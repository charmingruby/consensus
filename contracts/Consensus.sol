// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

import "./IConsensus.sol";
import "./ConsensusLib.sol";

contract Consensus is IConsensus {
    address private _manager;
    mapping(address => bool) private _counselors;
    mapping(address => uint8) private _leaders;
    mapping(uint8 => bool) private _groups;
    mapping(bytes32 => ConsensusLib.Topic) private _topics;
    mapping(bytes32 => ConsensusLib.Vote[]) private _votings;

    constructor() {
        _manager = msg.sender;

        for (uint8 i = 1; i <= 10; i++) {
            _groups[i] = true;
        }
    }

    function openVoting(string memory _title) external restrictedToManager {
        require(topicExists(_title), "Topic does not exists");

        ConsensusLib.Topic memory topic = getTopic(_title);

        require(
            topic.status == ConsensusLib.Status.IDLE,
            "Only IDLE topics can be open for voting"
        );

        bytes32 topicId = keccak256(bytes(_title));

        _topics[topicId].status = ConsensusLib.Status.VOTING;
        _topics[topicId].startDate = block.timestamp;
    }

    function vote(
        string memory _title,
        ConsensusLib.Options _option
    ) external restrictedToGroupLeaders {
        require(topicExists(_title), "Topic does not exists");
        require(_option != ConsensusLib.Options.EMPTY, "Option can't be EMPTY");

        ConsensusLib.Topic memory topic = getTopic(_title);
        require(
            topic.status == ConsensusLib.Status.VOTING,
            "Only VOTING topics can be voted"
        );

        uint8 groupId = _leaders[msg.sender];

        bytes32 topicId = keccak256(bytes(_title));
        ConsensusLib.Vote[] memory votes = _votings[topicId];
        for (uint256 i = 0; i < votes.length; i++) {
            if (votes[i].leader == msg.sender) {
                revert("Leader already voted");
            }
        }

        ConsensusLib.Vote memory newVote = ConsensusLib.Vote({
            leader: msg.sender,
            group: groupId,
            option: _option,
            createdAt: block.timestamp
        });

        _votings[topicId].push(newVote);
    }

    function closeVoting(string memory _title) external restrictedToManager {
        ConsensusLib.Topic memory topic = getTopic(_title);
        require(
            topic.status == ConsensusLib.Status.VOTING,
            "Only VOTING topics can be closed"
        );

        uint256 approved = 0;
        uint256 denied = 0;
        uint256 abstention = 0;

        bytes32 topicId = keccak256(bytes(_title));
        ConsensusLib.Vote[] memory votes = _votings[topicId];

        for (uint256 i = 0; i < votes.length; i++) {
            if (votes[i].option == ConsensusLib.Options.YES) {
                approved++;
            } else if (votes[i].option == ConsensusLib.Options.NO) {
                denied++;
            } else {
                abstention++;
            }
        }

        if (approved > denied) {
            _topics[topicId].status = ConsensusLib.Status.APPROVED;
        } else if (denied > approved) {
            _topics[topicId].status = ConsensusLib.Status.DENIED;
        } else {
            _topics[topicId].status = ConsensusLib.Status.DENIED;
        }

        _topics[topicId].endDate = block.timestamp;
    }

    function addLeader(
        address _leader,
        uint8 _groupId
    ) external restrictedToCouncil {
        require(groupExists(_groupId), "Group does not exists");

        _leaders[_leader] = _groupId;
    }

    function removeLeader(
        address _leader,
        uint8 _groupId
    ) external restrictedToManager {
        require(groupExists(_groupId), "Group does not exists");
        require(isLeader(_leader), "Leader does not exists");

        delete _leaders[_leader];

        if (isCounselor(_leader)) delete _counselors[_leader];
    }

    function setManager(address _newManager) external restrictedToManager {
        require(_newManager != address(0), "Address can't be null");
        require(
            _newManager != _manager,
            "New manager can't be the current manager"
        );

        _manager = _newManager;
    }

    function getManager() external view returns (address) {
        return _manager;
    }

    function setCounselor(
        address _counselor,
        bool _isEntering
    ) external restrictedToManager {
        if (_isEntering) {
            require(!isCounselor(_counselor), "Counselor already exists");
            require(isLeader(_counselor), "Counselor is not a leader");

            _counselors[_counselor] = true;

            return;
        }

        require(isCounselor(_counselor), "Counselor does not exists");

        delete _counselors[_counselor];
    }

    function addTopic(
        string memory _title,
        string memory _description
    ) external restrictedToGroupLeaders {
        require(!topicExists(_title), "Topic already exists");

        ConsensusLib.Topic memory newTopic = ConsensusLib.Topic({
            title: _title,
            description: _description,
            status: ConsensusLib.Status.IDLE,
            createdAt: block.timestamp,
            startDate: 0,
            endDate: 0
        });

        _topics[keccak256(bytes(newTopic.title))] = newTopic;
    }

    function removeTopic(string memory _title) external restrictedToManager {
        require(topicExists(_title), "Topic does not exists");

        ConsensusLib.Topic memory topic = getTopic(_title);

        require(
            topic.status == ConsensusLib.Status.IDLE,
            "Only IDLE topics can be removed"
        );

        delete _topics[keccak256(bytes(_title))];
    }

    function numberOfVotes(
        string memory _title
    ) external view returns (uint256) {
        bytes32 topicId = keccak256(bytes(_title));
        return _votings[topicId].length;
    }

    function getTopic(
        string memory _title
    ) public view returns (ConsensusLib.Topic memory) {
        bytes32 topicId = keccak256(bytes(_title));
        return _topics[topicId];
    }

    function groupExists(uint8 _groupId) public view returns (bool) {
        return _groups[_groupId];
    }

    function topicExists(string memory _title) public view returns (bool) {
        return getTopic(_title).createdAt > 0;
    }

    function isCounselor(address _counselor) public view returns (bool) {
        return _counselors[_counselor];
    }

    function isLeader(address _groupLeader) public view returns (bool) {
        return _leaders[_groupLeader] > 0;
    }

    modifier restrictedToManager() {
        require(
            msg.sender == _manager,
            "Only the manager can call this function"
        );
        _;
    }

    modifier restrictedToCouncil() {
        require(
            msg.sender == _manager || _counselors[msg.sender],
            "Only the council members can call this function"
        );
        _;
    }

    modifier restrictedToGroupLeaders() {
        require(
            msg.sender == _manager || isLeader(msg.sender),
            "Only the group leaders can call this function"
        );
        _;
    }
}
