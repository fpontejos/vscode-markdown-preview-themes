---
title: Sample document
author: Markdown Preview Themes
---

# The quick brown fox

A paragraph with **bold**, *italic*, ~~strikethrough~~, `inline code`, a [link](https://example.com), and a footnote-like reference[^1]. The five boxing wizards jump quickly. Sphinx of black quartz, judge my vow.

## Lists

1. First ordered item
2. Second ordered item
   - Nested bullet with `code`
   - Another nested bullet

- [x] Completed task
- [ ] Open task

> A blockquote. Pack my box with five dozen liquor jugs.
> — Someone, *somewhere*

### Table

| Column A | Column B | Number |
|----------|----------|-------:|
| alpha    | **bold** |   1.00 |
| beta     | `code`   |  42.50 |
| gamma    | [link](#) | 1337 |

### Code

```python
import re
from dataclasses import dataclass

@dataclass
class Token:
    kind: str
    value: str  # raw text

def tokenize(src: str) -> list[Token]:
    """Split source into tokens."""
    pattern = r"(?P<num>\d+)|(?P<name>[A-Za-z_]\w*)"
    return [Token(m.lastgroup or "?", m.group()) for m in re.finditer(pattern, src)]

print(tokenize("x1 = 42"), len("0123456789"))
```

```javascript
// Fetch and render
const render = async (url, { retries = 3 } = {}) => {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url);
    if (res.ok) return `<p>${await res.text()}</p>`;
  }
  throw new Error('failed');
};
```

```css
.vscode-body h1 { font-family: "Iosevka", monospace; letter-spacing: -0.02em; }
```

#### Smaller heading

Press <kbd>Cmd</kbd> + <kbd>Shift</kbd> + <kbd>V</kbd> to open the preview. 0O 1lI| {}[]() <> ;: ,. ~^

---

##### Even smaller heading

###### Smallest heading

[^1]: Footnote text.
