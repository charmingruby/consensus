// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

// Uncomment this line to use console.log
// import "hardhat/console.sol";

contract Consensus {
    address private _manager;
    mapping(address => bool) private _counselors;
    mapping(address => uint8) private _leaders;
    mapping(uint8 => bool) private _groups;

    enum Status {
        IDLE,
        VOTING,
        APPROVED,
        DENIED
    }

    struct Topic {
        string title;
        string description;
        Status status;
        uint256 createdAt;
        uint256 startDate;
        uint256 endDate;
    }

    mapping(bytes32 => Topic) private _topics;

    constructor() {
        _manager = msg.sender;

        for (uint8 i = 1; i <= 10; i++) {
            _groups[i] = true;
        }
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

        Topic memory newTopic = Topic({
            title: _title,
            description: _description,
            status: Status.IDLE,
            createdAt: 0,
            startDate: 0,
            endDate: 0
        });

        _topics[keccak256(bytes(newTopic.title))] = newTopic;
    }

    function removeTopic(string memory _title) external restrictedToManager {
        require(topicExists(_title), "Topic does not exists");

        Topic memory topic = getTopic(_title);

        require(topic.status == Status.IDLE, "Only IDLE topics can be removed");

        delete _topics[keccak256(bytes(_title))];
    }

    function getTopic(string memory _title) public view returns (Topic memory) {
        bytes32 topicId = keccak256(bytes(_title));
        return _topics[topicId];
    }

    function groupExists(uint8 _groupId) public view returns (bool) {
        return _groups[_groupId];
    }

    function isCounselor(address _counselor) public view returns (bool) {
        return _counselors[_counselor];
    }

    function isLeader(address _groupLeader) public view returns (bool) {
        return _leaders[_groupLeader] > 0;
    }

    function topicExists(string memory _title) public view returns (bool) {
        return getTopic(_title).createdAt > 0;
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
