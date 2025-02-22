# Greenroom: Dynamic AI Conversation Control System

A system for real-time control and visualization of AI conversations.

## Debug Tools

### CLI Chatbot

A debugging tool to help visualize conversation planning and tone progression. Shows how the AI plans responses and manages conversation flow.

```bash
# Run the debug chatbot
bun chat
```

Example output:
```
>> hey there

=== Current Context ===
## Task
Goal: Teach the user, a non-technical person, how to use Obsidian
Progress: 0%

## Conversation History
user: hey there

## Tone Progression
Current tones:
[2025-02-22T17:53:16.044Z] professional

Planned progression:
- professional (Trigger: current stage)
- friendly (Trigger: natural progression)
- collaborative (Trigger: natural progression)
- instructive (Trigger: natural progression)

=== AI Response Object ===
{
  "tone": {
    "current": "professional",
    "next": "friendly",
    "progress": "early"
  },
  "response": {
    "content": "Hello! How can I assist you...",
    "intent": "Establish professional rapport..."
  }
}
```

The debug output shows:
- Current conversation context
- Planned tone progression
- AI's reasoning and intent
- Response formatting

Commands:
- `exit`: Quit
- `history`: Show history
- `Ctrl+C`: Interrupt

## Development

```bash
# Install dependencies
bun install

# Set up OpenAI key
echo "OPENAI_API_KEY=your_key_here" > .env
```

## Features

- Real-time conversation planning with emotional tone progression
- Task-oriented dialogue management
- Detailed context tracking
- Color-coded terminal output
- Conversation history persistence
- Debug output showing AI's reasoning

## Installation

```bash
# Install dependencies
bun install

# Set up your OpenAI API key
echo "OPENAI_API_KEY=your_key_here" > .env

# Start the chat
bun chat
```

## How It Works

The chatbot uses a strategic conversation planner powered by GPT-4 to:
1. Track conversation progress
2. Manage emotional tone progression
3. Guide the conversation toward a specific goal
4. Adapt responses based on context

### Conversation Structure

Each turn of conversation includes:
- Task goal and progress
- Conversation history
- Tone progression history
- Planned tone stages

### Color Coding

- 🔵 Blue: Debug section headers
- 🟢 Green: Bot messages
- 🟣 Red: User messages
- 🟡 Yellow: Input prompt
- ⚪ Dim: System messages and debug content

### Commands

- `exit`: Quit the chat
- `history`: Show conversation history
- `Ctrl+C`: Interrupt and exit

## Technical Details

### Tone Progression

The chatbot manages a planned progression of tones:
```typescript
[
  "professional",
  "friendly",
  "collaborative",
  "instructive"
]
```

### Context Management

Each turn maintains:
```typescript
type Context = {
  conversationHistory: ChatMessage[];
  toneHistory: {
    tone: string;
    timestamp: number;
  }[];
  task: {
    goal: string;
    progress: number; // 0-1
  };
  nextTonePlan: {
    tone: string;
    trigger: string;
  }[];
};
```

### Response Schema

AI responses follow this structure:
```typescript
{
  tone: {
    current: string;
    next: string;
    progress: "early" | "middle" | "late";
  },
  response: {
    content: string;
    intent: string;
  }
}
```

## Future Improvements

- Voice conversation support
- Web UI integration
- Document-based context
- Multi-user support
- Custom tone progressions


## Screenshots

![screenshot](screenshots/CleanShot%202025-02-22%20at%2014.21.55.png)

![screenshot](screenshots/CleanShot%202025-02-22%20at%2014.38.22.gif)