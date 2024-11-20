// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

contract Market {
    enum Role {
        User,
        Admin,
        Owner
    }

    struct Option {
        uint256 id;
    }

    modifier isRole(Role role) {
        require(members[msg.sender] >= role, "insufficient permissions");
        _;
    }

    uint256 private fee;

    mapping(address => Role) private members;

    // use first bit to indicate long or short
    // id = uint256 >> 1, uint256 & 1 = set:long, unset:short
    mapping(uint256 => Option) private options;

    mapping(uint256 => mapping(address => uint256)) private option_members;

    mapping(address => mapping(uint256 => uint256)) private member_options;

    constructor(address payable _owner, uint256 _fee) {
        members[_owner] = Role.Owner;
        fee = _fee;
    }

    // ---------- member methods (start) ---------- //

    function joinAsMember() public {
        members[msg.sender] = Role.User;
    }

    function deleteMember(address member) public isRole(Role.Admin) {
        require(members[member] < Role.Admin, "cannot delete admin");
        delete members[member];
    }

    function updateMemberRole(address member, Role newRole) public isRole(Role.Admin) {
        members[member] = newRole;
    }

    // ---------- member methods (end) ---------- //

    // ---------- option methods (start) ---------- //

    function addOption() public isRole(Role.Admin) {}

    function expireOption() public isRole(Role.Admin) {
        // close for staking
        // settle balances
    }

    function deleteOption(uint256 id) public isRole(Role.Admin) {
        uint256 shortId = id << 1;
        delete options[shortId];
        // delete option_members[shortId]; // cannot delete mapping directly, commented out for now to avoid changing logic
        // delete member_options[];

        uint256 longId = shortId + 1;
        delete options[longId];
        // delete option_members[longId]; // cannot delete mapping directly, commented out for now to avoid changing logic
        // delete member_options[];
    }

    function stakeOption(uint256 id) public isRole(Role.User) {}

    function unstakeOption(uint256 id) public isRole(Role.User) {}

    function viewMemberBalance() public view isRole(Role.User) {
        mapping(uint256 => uint256) storage memberBalance = member_options[msg.sender];
        // for option in memberBalance, return
    }

    // ---------- option methods (end) ---------- //
}
