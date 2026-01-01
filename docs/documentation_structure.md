# TVM Solidity Compiler Documentation

This documentation helps developers familiar with Ethereum Solidity understand the differences, extensions, and new capabilities of TVM Solidity.

---

## Documentation Structure

### Getting Started

| Document | Description |
|----------|-------------|
| **Overview** | What is TVM Solidity, key differences from Ethereum at a glance |
| **Quick Start** | Your first TVM contract in 5 minutes |
| **Installation & Setup** | Compiler installation, toolchain, development environment |

### Core Concepts

| Document | Description |
|----------|-------------|
| **Architecture Overview** | TVM execution model, cells, slices, builders |
| **Message Model** | External vs internal messages, async execution, bouncing |
| **Gas & Payments** | How gas works in TVM, `tvm.accept()`, attaching value to messages |

### Migration

| Document | Description |
|----------|-------------|
| **[Migration Guide](migration-guide.md)** | Step-by-step guide for porting Ethereum Solidity contracts to TVM |

### Language Reference

| Document | Description |
|----------|-------------|
| **Types** | TVM-specific types (`TvmCell`, `TvmSlice`, `TvmBuilder`, `optional`, `variant`, `vector`, `stack`) and extended Solidity types (integers, addresses, mappings) |
| **Control Structures** | Range-based for loops, `repeat` statement, `try-catch` differences, `unchecked` blocks |
| **Contract Functions** | Special functions: `receive`, `fallback`, `onBounce`, `onTickTock`, `onCodeUpgrade`, `afterSignatureCheck` |
| **State Variables** | Keywords: `static`, `constant`, `unpacked`, `nostorage`; decoding state variables |
| **Compiler Directives** | Pragmas, function specifiers (`inline`, `functionID`) |

### API Reference

| Namespace | Description |
|-----------|-------------|
| **msg** | Message context: sender, value, body, flags |
| **tvm** | TVM operations: gas control, state management, code deployment |
| **math** | Mathematical functions: `min`, `max`, `abs`, `muldiv`, `divmod` |
| **abi** | Encoding and decoding: `encode`, `decode`, `encodeCell` |
| **bls** | BLS cryptography: signature verification |
| **tx** | Transaction info: `timestamp`, `storageFee` |
| **block** | Block info: `timestamp`, `logicaltime` |
| **rnd** | Random number generation |
| **gosh** | GOSH-specific functions: `diff`, `applyPatch` |

### Best Practices

| Document | Description |
|----------|-------------|
| **Gas Optimization** | Tips for reducing gas consumption |
| **Security Patterns** | Common security patterns for TVM contracts |
| **External Calls** | Best practices for calling other contracts |

### Reference

| Document | Description |
|----------|-------------|
| **Exception Codes** | TVM exception codes and their meanings |
| **Runtime Errors** | Solidity runtime error codes |
| **TVM Capabilities** | Feature flags and capabilities |




