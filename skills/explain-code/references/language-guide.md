# Language-Specific Explanation Guide

When explaining code, keep these language-specific concepts in mind. These are the patterns and idioms that most often need clarification for readers unfamiliar with a given language.

## JavaScript / TypeScript

- **async/await and Promises**: Explain the asynchronous execution model, how Promises chain, and how async/await is syntactic sugar over Promises
- **Closures and scope**: Clarify how inner functions capture variables from outer scopes, and the difference between `var`, `let`, and `const` scoping
- **`this` binding**: Explain how `this` differs in regular functions vs arrow functions, and how `.bind()`, `.call()`, `.apply()` work
- **Event handling and callbacks**: Describe the event loop, callback patterns, and how events propagate
- **Destructuring and spread**: Explain object/array destructuring and the spread operator

## Python

- **List comprehensions and generators**: Explain the concise syntax and when generators are preferred for memory efficiency
- **Decorators**: Describe how `@decorator` syntax wraps functions, common use cases (logging, auth, caching)
- **Context managers**: Clarify `with` statements and the `__enter__`/`__exit__` protocol
- **Class inheritance and MRO**: Explain method resolution order, `super()`, and multiple inheritance
- **Dunder methods**: Explain `__init__`, `__repr__`, `__str__`, `__eq__`, and other magic methods

## Java

- **Generics and type parameters**: Explain type erasure, bounded types, and wildcard usage
- **Annotations**: Describe how `@Override`, `@Autowired`, `@Entity`, etc. work and their processing
- **Streams and lambdas**: Clarify the Stream API pipeline, intermediate vs terminal operations, and lambda syntax
- **Exception hierarchy**: Explain checked vs unchecked exceptions, and the try-with-resources pattern

## C#

- **LINQ queries**: Explain both query syntax and method syntax, deferred execution
- **async/await and Task**: Describe the Task-based asynchronous pattern and `ConfigureAwait`
- **Delegates and events**: Clarify delegate types, multicast delegates, and the event pattern
- **Nullable reference types**: Explain the nullable context, `?` and `!` operators

## Go

- **Goroutines and channels**: Explain lightweight concurrency, channel communication, and `select` statements
- **Interfaces**: Describe implicit interface implementation and how it enables duck typing
- **Error handling**: Clarify the `error` interface, the `if err != nil` pattern, and error wrapping
- **Package structure**: Explain exported vs unexported identifiers, package initialization with `init()`

## Rust

- **Ownership and borrowing**: Explain the ownership model, move semantics, and borrow rules
- **Lifetimes**: Describe lifetime annotations, why they exist, and common lifetime patterns
- **Pattern matching**: Clarify `match` expressions, `if let`, and destructuring with `Option`/`Result`
- **Traits**: Explain trait definitions, implementations, trait bounds, and dynamic dispatch with `dyn`
- **The `?` operator**: Explain early return on error and how it works with `Result` and `Option`
