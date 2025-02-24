# Greenroom

Shape the behind-the-scenes flow of AI conversations in real-time with a whiteboard.

## The Problem: Breaking Free from AI's Personality Prison

Imagine trying to have a natural conversation with someone who can only speak in one tone, or worse, someone whose personality you can only set once at the beginning of the conversation. That's the current state of AI conversation systems - they're either completely scripted or completely autonomous, with no middle ground. This binary approach creates a fundamental disconnect in real-world applications where conversations need to flow naturally while maintaining purposeful direction.

Current limitations force developers to choose between:
- Complete control through rigid prompting, sacrificing natural flow
- Full AI autonomy, losing the ability to guide the conversation
- Static personality settings that can't adapt to changing contexts
- One-size-fits-all approaches that break down in group settings

## Our Solution: The Visual Programming Revolution for AI Conversations

We've built something with more visual control over AI conversations. Instead of treating AI conversation as a simple input/output system, the interface helps you shape AI personality and conversation flow in real-time - like a DJ mixing tracks, but for AI behavior.

For our hackathon demo, we're showcasing this through an AI pitch coach that provides feedback on our "Visual AI Steering" pitch while demonstrating dramatic personality shifts. This extreme example highlights the system's ability to maintain coherent feedback while transitioning between wildly different emotional states - from analytical robot to passionate cheerleader - all under your real-time control.

Our system introduces:
- **Visual Timeline Control**: A drag-and-drop interface that turns conversation planning into an intuitive visual experience
- **Real-time Tone Steering**: Dynamic control over AI personality that feels like conducting an orchestra of emotions
- **Collaborative Whiteboard**: A shared workspace where multiple stakeholders can shape conversation flow together
- **Live Voice Integration**: Seamless voice interaction that responds instantly to your steering

## Tech Stack

- TLDraw for the whiteboard
- Web Speech API for automatic speech recognition
- ElevenLabs for voice synthesis
- OpenAI for agentic steering of conversation flow
- Vercel AI SDK for structured output extraction, i.e. tone plan, response content, intent strategy

## Key Technical Innovations

### 1. Real-time Agent Architecture: The Brain Behind the Magic
We threw out the traditional chatbot playbook and built our own agent system from scratch. The ElevenLabs Conversational AI product does not support changing AI agent behavior in real-time, so we built a whiteboard interface to adjust the agent personality over the course of the conversation. This features:
- Predictive tone state management that can smoothly transition between emotional states
- Dynamic behavior adjustment that responds to timeline position like a musician following a conductor
- Lightning-fast state propagation that makes the system feel alive and responsive

### 2. Advanced Audio Streaming: Making AI Voice Feel Human
Voice interaction isn't just about text-to-speech - it's about creating a seamless, natural experience. We solved several critical challenges:
- Smart buffering that predicts and pre-loads the next audio chunk like a DJ queuing the next track
- Microsecond-precise crossfading that eliminates the robotic gaps in speech
- Web Audio API orchestration that keeps everything in perfect time
- Voice modulation that matches the AI's current emotional state

### 3. Visual Programming Interface: Conversation as Code
We've transformed abstract conversation design into a visual programming language:
- Timeline-based execution that lets you see and shape the future of the conversation
- Spatial arrangement that turns position into meaning
- Real-time flow modification that feels like live coding
- Visual debugging that makes conversation state tangible

## Use Cases: Real-world Impact

1. **Professional Consulting**: Transform client interactions
   - Perfect your pitch through real-time personality adjustment
   - Practice client presentations with instant feedback
   - Optimize sales conversations on the fly

2. **Educational Applications**: Revolutionize teaching
   - Create learning paths that adapt to student engagement
   - Adjust teaching style based on comprehension
   - Deliver content at the perfect pace

3. **Therapeutic Conversations**: Enable better care
   - Track emotional progression visually
   - Control tone transitions with precision
   - Adjust therapy approach in real-time

4. **Group Facilitation**: Enhance collaboration
   - Steer discussions with surgical precision
   - Manage multiple conversation threads
   - Adapt facilitation style to group dynamics

## Future Development: Beyond the Demo

Our hackathon demo shows extreme personality transitions in a pitch feedback session, but this is just the beginning. Our roadmap includes:

### Dynamic Context Integration
- **Model Context Protocol (MCP)**: A sophisticated system for feeding dynamic context to the AI in real-time
- **Document Vault Integration**: CLI tool for instantiating conversations from Markdown document collections

### Enhanced Interaction Models
- Document upload interface for instant context creation
- Real-time document reference during conversations
- Multi-document context synthesis
- Collaborative document annotation

### Platform Evolution
- Enhanced group collaboration features
- Advanced voice modulation controls
- Expanded use case templates
- Integration with additional AI models

The future of Greenroom is about more than just tone control - it's about creating a comprehensive system for managing AI conversations with full context awareness and real-time adaptability.

## Setup
```sh
# .env file
echo "VITE_OPENAI_API_KEY=KEY" >> .env
echo "VITE_ELEVEN_LABS_API_KEY=KEY" >> .env
echo "XI_API_KEY=KEY" >> .env

```sh
bun install
# backend
bun run server
# frontend
bun run dev
```