# Principles:

## Tech stack 
Use SQLite compiled to WebAssembly for the database engine and persist all conversation data in the browser using the Origin-Private File System (OPFS) as the storage backend.


## Core Principles
Simplicity over complexity
Readability over brevity
Consistency over randomness
Maintainability over quick hacks

Modularity
Reusability
Testability


### HTML
Build components that can be reused.
Semantic HTML.
Assign data-action, data-state when needed.
Use BEM.
Stay minimal.

### CSS
Responsive design (mobile-first).
Use BEM for all class names.
No IDs for styling.
No inline styles.


### JavaScript
Keep JS modular (small functions).
Avoid global variables.
Target elements using data-action not classes nor ids. id → accessibility (Anchors).
Modular code (split into functions/modules).
Avoid global scope pollution.
keep it minimal.

### Views 
The system’s core logic must be independent of any view layer.
Never couple business logic with UI concerns (no DOM, CLI handling, or formatting inside core logic).
The system should be view-agnostic, allowing external consumers to choose their own interface (GUI, CLI, API, raw JSON, etc.).
Expose functionality through clean, well-defined interfaces or APIs.
Return structured, predictable data (e.g., objects, JSON), not formatted UI output.
