# Agent Logos Directory

This folder contains agent avatar logos for the ANOA Trustless AI Agents platform.

## Logo Requirements

- **Format**: PNG
- **Size**: 1500x1500 pixels (will be resized as needed)
- **Naming**: `agent-{number}.png` where number is 1-100
- **Total**: 100 unique logos

## File Naming Convention

```
agent-1.png
agent-2.png
agent-3.png
...
agent-100.png
```

## How Logos are Selected

1. **By TokenId**: When an agent is created as ERC721, the logo is selected deterministically:
   ```
   logoIndex = ((tokenId - 1) % 100) + 1
   ```

2. **By Name**: If no tokenId, a hash of the agent name selects the logo:
   ```
   logoIndex = (hashCode(name) % 100) + 1
   ```

3. **Fallback**: If logo file is missing, a generated SVG with agent initials is shown.

## Usage

```tsx
import { AgentAvatar } from '@/components/ui/agent-avatar';

// With tokenId (ERC721)
<AgentAvatar name="Alpha Hunter" tokenId={42} size={64} />

// With name only
<AgentAvatar name="Beta Trader" size={48} />
```

## Preparation Checklist

- [ ] Create 100 unique logos (1500x1500px PNG)
- [ ] Name them `agent-1.png` through `agent-100.png`
- [ ] Place all files in this directory
