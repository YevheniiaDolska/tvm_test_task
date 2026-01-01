# Migration Guide: From Ethereum Solidity to TVM Solidity

This guide helps Ethereum Solidity developers port their existing contracts to TVM Solidity. It covers key differences, common pitfalls, and provides before/after code examples for each major change.

---

## Overview

TVM Solidity uses Solidity syntax familiar to Ethereum developers, but compiles to the TON Virtual Machine (TVM). While the language looks similar, the underlying execution model is fundamentally different. The most significant change is the **asynchronous message-based execution model** - contracts don't call each other directly; they send messages.

> **Key Insight:** Think of TVM contracts as independent actors communicating via messages, not as functions calling other functions.

---

## Quick Reference: What Changes

| Area | Ethereum Solidity | TVM Solidity | Action Required |
|------|-------------------|--------------|-----------------|
| External calls | Synchronous | Asynchronous messages | Redesign call patterns |
| Addresses | 20 bytes | Workchain ID + 256 bits | Update address handling |
| Integer range | Up to 256 bits | Up to 257 bits | Usually none |
| Gas payment | Caller pays | Contract can pay (`tvm.accept()`) | Add gas acceptance logic |
| Error handling | Revert propagates | Bounced messages | Implement `onBounce` |
| Replay protection | Nonce in transaction | Manual implementation | Add replay protection |
| Return values | Direct return | Via callback messages | Redesign return flow |

---

## 1. Address Format

### The Difference

Ethereum uses a simple 20-byte address. TVM uses a two-part address: a signed 8-bit workchain ID and a 256-bit account identifier.

### Migration

**Ethereum Solidity:**
```solidity
address payable x = payable(0x123);
address myAddress = address(this);
if (x.balance < 10 && myAddress.balance >= 10) x.transfer(10);
```

**TVM Solidity:**
```solidity
// Construct address with workchain id and value
int8 wid = 0;
uint value = 0x123...;
address addrStd = address.makeAddrStd(wid, value);

// Or from just the value (workchain 0)
uint address_value = 0x123...;
address addrStd = address(address_value);
```

### Format Examples

```solidity
string str;
str = format("{}", address.makeAddrStd(127, 0));
// str == "7f:0000000000000000000000000000000000000000000000000000000000000000"

str = format("{}", address.makeAddrStd(-128, 0));
// str == "-80:0000000000000000000000000000000000000000000000000000000000000000"
```

---

## 2. External Calls: From Synchronous to Asynchronous

### The Difference

This is the most significant change. In Ethereum, external calls are synchronous - you call a function and get a result immediately. In TVM, all external function calls are asynchronous - the callee function will be called after termination of the current transaction.

### Migration Pattern: Fire-and-Forget

**Ethereum Solidity:**
```solidity
contract InfoFeed {
    function info() public payable returns (uint ret) { return 42; }
}

contract Consumer {
    InfoFeed feed;
    function setFeed(InfoFeed addr) public { feed = addr; }
    function callFeed() public { feed.info{value: 10, gas: 800}(); }
}
```

**TVM Solidity:**
```solidity
interface IContract {
    function f(uint a) external;
}

contract Caller {
    function callExt(address addr) public {
        IContract(addr).f{value: 10 ever}(123);
        IContract(addr).f{value: 10 ever, flag: 3}(123);
        IContract(addr).f{value: 10 ever, bounce: true}(123);
    }
}
```

### Migration Pattern: Getting Return Values

**Ethereum Solidity:**
```solidity
contract OwnedToken {
    TokenCreator creator;
    address owner;

    function transfer(address newOwner) public {
        if (msg.sender != owner) return;
        if (creator.isTokenTransferOK(owner, newOwner))
            owner = newOwner;
    }
}
```

**TVM Solidity:**
```solidity
contract RemoteContract {
    // Note: function is marked as `responsible` to enable callback
    function getCost(uint x) public pure responsible returns (uint) {
        uint cost = x == 0 ? 111 : 222;
        // return cost and set options for outbound internal message
        return{value: 0, bounce: false, flag: 64} cost;
    }
}

contract Caller {
    function test(address addr, uint x) public pure {
        // `getCost` returns result to `onGetCost`
        RemoteContract(addr).getCost{value: 1 ever, callback: Caller.onGetCost}(x);
    }

    function onGetCost(uint cost) public {
        // Check if msg.sender is expected address
        // we get cost value, we can handle this value
    }
}
```

### Key Points

- Always attach value to messages: `{value: 10 ever}`
- If `value` isn't set, the default is 0.01 ever (10^7 nanoever)
- Use `bounce: true`  when calling other contracts to receive error notifications (**Note:** The notification is generated only if the remaining message value is enough for sending it back)
- Use `responsible` modifier and `callback` option for return values
- Use `{value: 0, bounce: false, flag: 64}` when returning callback responses

---

## 3. Gas and Payment Model

### The Difference

In Ethereum, the transaction sender always pays gas. In TVM, the contract can accept responsibility for gas payment using `tvm.accept()`.

### Migration: External Functions

**Ethereum Solidity:**
```solidity
contract MyContract {
    function doSomething() external {
        // Caller pays gas, no special handling needed
    }
}
```

**TVM Solidity:**
```solidity
tvm.accept();
```

> `tvm.accept()` executes TVM instruction "ACCEPT" which sets current gas limit to its maximal allowed value. This action is required to process external messages that bring no value.

### Migration: Sending Value

**Ethereum Solidity:**
```solidity
function withdraw() external {
    uint amount = pendingReturns[msg.sender];
    if (amount > 0) {
        pendingReturns[msg.sender] = 0;
        payable(msg.sender).transfer(amount);
    }
}
```

**TVM Solidity:**
```solidity
contract Bomber {
    function f(address addr) pure public {
        tvm.accept();
        addr.transfer({value: 1 ever}); // message's body is empty

        TvmBuilder b;
        addr.transfer({value: 1 ever, body: b.toCell()}); // message's body is empty, too

        b.store(uint32(0), "Thank you for the coffee!");
        // body of the message contains 32-bit zero number and the string
        addr.transfer({value: 20 ever, body: b.toCell()});
    }
}
```

### Key Points

- Use `tvm.accept()` for external message handlers
- Attach value to all outgoing messages
- Consider using `{flag: 64}` to forward remaining gas

---

## 4. Error Handling: Bounced Messages

### The Difference

In Ethereum, when an external call fails, the entire transaction reverts (unless using try-catch). In TVM, failed messages "bounce" back to the sender.

### When Bouncing Occurs

The message is generated by the network if the contract sends an internal message with `bounce: true` and either:
- Called contract doesn't exist
- Called contract fails at the storage/credit/computing phase (not at the action phase!)

### Migration

**Ethereum Solidity:**
```solidity
interface DataFeed {
    function getData(address token) external returns (uint value);
}

contract FeedConsumer {
    DataFeed feed;
    uint errorCount;

    function rate(address token) public returns (uint value, bool success) {
        require(errorCount < 10);
        try feed.getData(token) returns (uint v) {
            return (v, true);
        } catch Error(string memory /*reason*/) {
            errorCount++;
            return (0, false);
        } catch (bytes memory /*lowLevelData*/) {
            errorCount++;
            return (0, false);
        }
    }
}
```

**TVM Solidity:**
```solidity
onBounce(TvmSlice body) external {
    /*...*/
}
```

With full body support:
```solidity
onBounce(TvmSlice body) external {
    TvmSlice fullBody = body.loadRef().toSlice();
    uint32 functionId = fullBody.load(uint32);
}
```

### Key Points

- Set `bounce: true` when you want to know about failures
- Implement `onBounce` to handle failures
- `body` contains at most 256 data bits of the original message (function id takes 32 bits)
- If `onBounce` is not defined, contract does nothing on receiving bounced message
- Use `bounce: false` for messages that shouldn't bounce

---

## 5. Replay Protection

### The Difference

Ethereum handles replay protection automatically via the transaction nonce. TVM requires explicit implementation.

### Migration

**Ethereum Solidity:**
```solidity
// No special code needed - nonce is handled by the protocol
contract MyContract {
    function doSomething() external {
        // Safe from replay attacks
    }
}
```

**TVM Solidity - Using Attributes:**
```solidity
#[ExternalMessage(time,expire)]
#[TimeReplayProt]
contract C { }

#[ExternalMessage(time,expire,pubkey)]
#[SeqnoReplayProt]
contract C2 { }
```

### Key Points

- Use `#[TimeReplayProt]` or `#[SeqnoReplayProt]` attributes for built-in protection
- This is critical for security

---

## 6. Contract Deployment

### The Difference

Contract deployment works differently. In Ethereum, the contract address depends on deployer address and nonce. In TVM, the address is calculated as a hash of the `stateInit`, which includes code and `static` variables. Constructor parameters don't influence the address.

Either `code` or `stateInit` option must be set when you deploy a contract from contract via keyword `new`. Use `stateInit` if you have the created account state, use `code` if you want to create account state in the `new` expression.

### Migration

**Ethereum Solidity:**
```solidity
contract OwnedToken {
    TokenCreator creator;
    address owner;
    bytes32 name;

    constructor(bytes32 name_) {
        owner = msg.sender;
        creator = TokenCreator(msg.sender);
        name = name_;
    }
}
```

**TVM Solidity:**
```solidity
// file SimpleWallet.sol
contract SimpleWallet {
    address static m_owner;
    uint static m_value;
    // ...
}

// file containing a contract that deploys a SimpleWallet
TvmCell code = ...;
address newWallet = new SimpleWallet{
    value: 1 ever,
    code: code,
    pubkey: 0xe8b1d839abe27b2abb9d4a2943a9143a9c7e2ae06799bd24dec1d7a8891ae5dd,
    varInit: {m_owner: address(this), m_value: 15}
}(arg0, arg1, ...);
```

### Key Points

- Address is calculated as a hash of `stateInit` (deterministic deployment)
- Constructor parameters don't influence the address — use `static` variables instead
- Use `varInit` to set `static` variables when deploying with `code` option
- Use `stateInit` option if you already have the complete state
- Always attach `value` to fund the new contract

---

## 7. Data Types

### Extended Integer Range

TVM supports integers up to 257 bits:

```solidity
int257 signedMax;     // Larger than Ethereum's int256
uint256 unsigned;     // Same as Ethereum
uint257 unsignedMax;  // Larger than Ethereum
```

### Quiet Arithmetic Types

Operations with `qintN` / `quintN` return `NaN` instead of throwing integer overflow exceptions:

```solidity
function f(quint32 a, quint32 b) private pure {
    quint32 s = a + b;
    if (!s.isNaN()) {
        uint32 sum = s.get();
        // ...
    }
}
```

Using `getOr` for default values:
```solidity
function f(quint32 a, quint32 b) private pure {
    quint32 s = a + b;
    uint32 sum = s.getOr(42); // sum is equal to `a + b` or 42
    // ...
}
```

Using `getOrDefault`:
```solidity
function f(quint32 a, quint32 b) private pure {
    quint32 s = a + b;
    uint32 sum = s.getOrDefault(); // sum is equal to `a + b` or 0
    // ...
}
```

### TVM-Specific Types

```solidity
TvmCell cell;      // Raw cell data
TvmSlice slice;    // For reading cell data
TvmBuilder builder; // For constructing cell data

optional(uint256) maybeValue;  // Nullable type
```

---

## 8. Special Functions

TVM Solidity introduces several special functions:

| Function | Purpose | Ethereum Equivalent |
|----------|---------|---------------------|
| `receive()` | Handle plain value transfers | `receive()` |
| `fallback()` | Handle unknown function calls | `fallback()` |
| `onBounce(TvmSlice)` | Handle bounced messages | None (use try-catch) |
| `onTickTock(bool)` | Called by validator on each block | None |
| `onCodeUpgrade(TvmCell)` | Called after code upgrade | None |
| `afterSignatureCheck(TvmSlice, TvmCell)` | Custom signature validation | None |

### receive() Example

```solidity
contract Sink {
    uint public counter = 0;
    uint public msgWithPayload = 0;
    receive() external {
        ++counter;
        // if the inbound internal message has payload, then we can get it using `msg.body`
        TvmSlice s = msg.body;
        if (!s.empty()) {
            ++msgWithPayload;
        }
    }
}
```

---

## Migration Checklist

Use this checklist when porting a contract:

### Architecture
- [ ] Redesigned external calls to use async message pattern
- [ ] Added callback functions for return values (use `responsible` modifier)
- [ ] Updated address format handling

### Security
- [ ] Implemented replay protection (use `#[TimeReplayProt]` or manual)
- [ ] Added `onBounce` handlers for critical operations
- [ ] Verified gas attachment on all outgoing messages

### Gas Model
- [ ] Added `tvm.accept()` where contract pays for execution
- [ ] Attached appropriate value to all messages
- [ ] Considered gas forwarding patterns (`flag: 64`)

### Data Types
- [ ] Updated integer types if using extended range
- [ ] Considered quiet arithmetic where appropriate
- [ ] Migrated to TVM-specific types where beneficial

### Deployment
- [ ] Updated constructor pattern (marked `public`)
- [ ] Handled state init for deterministic addresses
- [ ] Tested deployment flow

---

## Common Pitfalls Summary

| Pitfall | Problem | Solution |
|---------|---------|----------|
| Synchronous thinking | Expecting immediate results from calls | Use callbacks, design for async |
| Missing `tvm.accept()` | Transaction fails silently | Add accept in external handlers |
| No bounce handling | Unaware of failed calls | Implement `onBounce` |
| No replay protection | Vulnerable to replay attacks | Use `#[TimeReplayProt]` or check timestamps |
| Insufficient message value | Messages fail to execute | Always attach adequate value |
| Wrong address format | Address operations fail | Use `address.makeAddrStd()` |

