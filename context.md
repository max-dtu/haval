# Context for ai:

## Core Principles
Simplicity over complexity
Readability over brevity
Consistency over randomness
Maintainability over quick hacks

Modularity
Reusability
Testability


### HTML
Build components; self-contained block of HTML + CSS that can be reused.
Semantic HTML (use proper tags like <form>, <section>, <nav>)
Accessibility (a11y) (labels, alt text, ARIA when needed)
Structured content (logical hierarchy with headings)
Assign data-action, data-state when needed.


### CSS
Responsive design (mobile-first)
Use BEM for all class names
No IDs for styling
No inline styles


### JavaScript
Keep JS modular (small functions)
Avoid global variables
Target elements using data-action not classes nor ids. id → accessibility (Anchors).
Modular code (split into functions/modules)
Event-driven design
Avoid global scope pollution
keep it minimal

### Views 
The system’s core logic must be independent of any view layer.
Never couple business logic with UI concerns (no DOM, CLI handling, or formatting inside core logic).
The system should be view-agnostic, allowing external consumers to choose their own interface (GUI, CLI, API, raw JSON, etc.).
Expose functionality through clean, well-defined interfaces or APIs
Return structured, predictable data (e.g., objects, JSON), not formatted UI output
