# Dynamic AI Conversation Control System

## User journey

Imagine you're a consultant who regularly leads complex client conversations. You've used AI assistants before, but they've always felt like rigid, one-way interactions - you either let the AI take control, or you handle everything yourself. There's never been a middle ground where you could truly collaborate with the AI in real-time.

That's when you discover this system. At first glance, it looks like a simple whiteboard interface, but as you dig deeper, you realize it's fundamentally different from anything you've used before.

The first thing you notice is how naturally you can set up a conversation. Instead of wrestling with prompts or complex configurations, you simply drag in relevant documents - previous client notes, industry research, meeting summaries. The system begins arranging these as interconnected nodes on the whiteboard, creating a visual map of the concepts in the conversation.

During your first client call, you experience the real magic. As the conversation flows, you see the system tracking progress on a timeline, rearranging documents on the whiteboard to foreshadow directions the conversation might take. But unlike traditional AI assistants, you're not locked into these suggestions. By modifying the whiteboard, you can steer the conversation's tone and direction in real-time.

What's particularly striking is how the system maintains context awareness. When your client brings up different arguments, the system rearranges the documents later down the timeline on the whiteboard to reflect the new concepts and relationships. It's like having a brilliant co-pilot who not only remembers everything but knows exactly when to bring up each piece of information.

The collaborative aspects become apparent in group sessions. During a team workshop, participants can interact with the whiteboard, rearranging concepts and adding notes. The AI adapts its facilitation style based on these interactions, creating a truly dynamic group experience. It's no longer just an AI assistant - it's a collaborative platform that enhances human-to-human communication.

Over time, you discover more sophisticated uses. For therapy sessions, the system helps track emotional progression through visual cues. For educational workshops, it creates interactive learning paths that adapt to student engagement. Each use case reveals new depths to the system's capabilities.

One example of a context provider that could make this work is the underlying Model Context Protocol (MCP) - though you don't need to understand its complexity. You just see the results: an AI system that can finally be a true conversation partner, one that you can guide and work with rather than simply command or follow.

This isn't just an incremental improvement in AI interaction - it's a fundamental rethinking of how humans and AI can collaborate in conversations. It maintains the power and knowledge of AI while adding the nuance, adaptability, and real-time control that human conversations require.

## Problem Statement
Current AI conversation systems are rigid and one-dimensional, lacking:
- Real-time control over conversation direction and tone
- Visual representation of conversation progress and context
- Ability to seamlessly integrate multiple knowledge sources
- Collaborative steering of AI conversations in group settings

## Solution: Adaptive Conversation Control Interface

### Core Components

1. **Driver Interface**
   - Setup through CLI or composer shell
   - Configure data sources and context protocol
   - Define conversation goals and parameters
   - Drag-and-drop document integration

2. **Agent System**
   - Real-time conversation management
   - Dynamic task handling capabilities:
     - Teaching/instruction delivery
     - Document-based argumentation
     - Context completion
     - Therapeutic conversation based on notes/experience
     - Narrative construction

3. **Visual Whiteboard Interface**
   - Real-time conversation visualization
   - Node-based information representation
   - Timeline showing conversation progression
   - Interactive document arrangement
   - Progress tracking with visual indicators

### Key Features

1. **Real-time Conversation Control**
   - Dynamic context manipulation
   - Live tone and style adjustment
   - Visual progress tracking
   - Multi-document context integration

2. **Group Collaboration Tools**
   - Multi-recipient support for group discussions
   - Shared whiteboard for collaborative arrangement
   - Real-time document annotation
   - Discussion facilitation features

3. **Knowledge Integration**
   - Seamless document incorporation
   - Progressive information revealing
   - Context-aware document suggestions
   - Dynamic knowledge base building

4. **Visual Progress Tracking**
   - Timeline-based progression
   - Node-based information mapping
   - Real-time strategy visualization
   - Progress indicators and milestones

### Use Cases

1. **Educational Sessions**
   - Progressive concept introduction
   - Visual knowledge mapping
   - Interactive learning paths
   - Real-time comprehension tracking

2. **Group Facilitation**
   - Book club discussions
   - Team brainstorming sessions
   - Collaborative document analysis
   - Guided group conversations

3. **Professional Conversations**
   - Client consultations
   - Therapy sessions
   - Sales conversations
   - Training delivery

4. **Document-Based Discussions**
   - Research analysis
   - Document review sessions
   - Content creation
   - Information synthesis

### Technical Innovation

- Model Context Protocol (MCP) for real-time steering
- Visual representation of conversation state
- Dynamic document context integration
- Real-time tone and style adaptation
- Collaborative whiteboard functionality

### Setup Flow

1. Initial Configuration
   - Driver setup via CLI/composer
   - Data source specification
   - Context protocol definition
   - Document integration

2. Conversation Initialization
   - Phone call/session setup
   - Whiteboard preparation
   - Context loading
   - Participant connection

3. Active Session Management
   - Real-time context manipulation
   - Document progression control
   - Visual state monitoring
   - Collaborative arrangement

4. Progress Tracking
   - Timeline advancement
   - Knowledge state visualization
   - Context evolution tracking
   - Milestone achievement monitoring

This system represents a significant advancement in AI conversation control, offering unprecedented real-time manipulation of conversation flow while maintaining context awareness and collaborative capabilities.

# Progress

## Random initial notes
MVP of "scenario": teaching mom obsidian after using google docs

MVP of whiteboard UI

MVP of prompt
- "planning for direction of tone"
- agent prompt input components (initial implementation, should at least do this):
  - should receive conversational history (each turn)
  - should receive instructions for the task (to accomplish over the course of the conversation), and plan to achieve that task through conversation with RECIPIENT

- agent prompt state details (should leave room for this to update based on shared state in realtime):
  - the state will update in realtime, so have placeholders for the "tone" arrangment and "doc" arrangement (as the DRIVER updates them in the whiteboard)

- agent operation details:
  - should effectively chart the course of the conversation's tone
  - should figure out what to say next to RECIPIENT based on the conversational history and the task

MVP of agent architecture:
- write to a JSON file locally with the tone course and the next turn


## Done:
[x] CLI chatbot
[x] prototype the agent prompt
[x] transform shapes (as updated from whiteboardapp as they are created) into a persistent data structure (e.g. a JSON file) so that the CLI chatbot can read it
[x] update the CLI chatbot to read the persistent data structure and learn about the spatial structure of the whiteboard. For now its nodes are to be tones, but later it will be documents and their relationships
[x] initialize the whiteboard with a progression of tones visually represented as shapes on the whiteboard. proportion them according to the specified duration of the conversation / what would feel natural
[x] design prompting to semantically represent the timestamps a bit better -- what's close (within trigger threshold, give it some sentinel value) or far (past the trigger threshold -- in which case we just present its distance as a relative value)
[x] have the agent be able to adapt the tone progression --> whiteboard state
[x] implement threshold based on playhead vs. shape position
[x] incorporate staged_within_threshold into the agent prompt -- as indicative that the agent can transition to the next tone in the next turn of the conversation, if it decides to.
[x] tone output should be a progression and not just a single tone / current tone

1. Initial Tone Plan Generation
[x] Agent should generate initial tone progression on startup
[x] Write this initial plan to shapes.json with proper timing/positioning
[x] Ensure timing is proportional to conversation duration

2. Driver-Agent Interaction
[x] When driver (human) modifies whiteboard:
  [x] Detect which shapes are being actively modified
  [x] Write updated positions/timing to shapes.json
  [x] Preserve these manual adjustments in future updates

3. Recipient-Driven Updates
[x] When recipient's responses trigger agent to update tone progression:
  [x] Respect existing relative positioning of tones from whiteboard
  [x] Only modify tones that haven't been manually adjusted
  [x] Update timing proportionally based on conversation progress

4. Whiteboard Update Rules
[x] Only update shapes that:
  [x] Are not currently being modified by driver
  [x] Haven't been manually positioned recently
  [x] Need status updates (past/staged/future)
[x] Preserve manual positioning and timing adjustments
[x] Update colors/status without moving shapes when possible

5. Timing Synchronization
[x] Keep timing in prompt synchronized with whiteboard positions
[x] Use relative positioning (% through conversation) rather than absolute times
[x] Ensure staged_within_threshold reflects actual playhead position

This approach ensures:
[x] Driver maintains control over tone positioning
[x] Agent respects manual adjustments
[x] Whiteboard stays stable during edits
[x] Timing remains proportional to conversation progress

[x] chatbot as part of debug panel
[x] Need to turn chatbot into part of debug panel in ActiveDocuments.tsx

MVP of conversational context prompt updates
[x] whiteboard playback progress should update the prompt in real time by excluding "past nodes" and  including "future nodes"... needs:  
  [x] whiteboard UI  
  [x] agent prompt

MVP of agent updating whiteboard state
[x] what's included:  
  [x] only nodes in the future or to the right (playhead has not touched yet)  
  [x] if playhead overlaps with node, the node shouldn't be used for planning (edge case for future – needing to extend duration of node)  
  [x] exclude everything to the left

[x] less finicky new box creation

[x] Voice Chat Implementation
1. Audio Queueing System
   - Implemented `AudioQueueManager` class for sequential audio playback
   - Handles audio chunks with alignment data for precise timing
   - Manages queue state and playback scheduling using Web Audio API
   - Provides clean error handling and queue cleanup

2. Web Speech Recognition
   - Integrated Web Speech API for real-time speech recognition
   - Handles both interim and final transcripts
   - Implements silence detection for speech end detection
   - Manages recognition state and error recovery
   - Provides detailed logging of speech events and audio levels

3. Streaming ElevenLabs Integration
   - Implemented WebSocket connection to ElevenLabs streaming API
   - Handles real-time audio chunk processing and queueing
   - Manages audio alignment data for debugging
   - Provides error handling and connection cleanup
   - Integrates with ChatBot for response generation

4. Audio System Architecture
   - Centralized audio context management
   - Component-level state management using signals
   - Clean separation of concerns between recognition, synthesis, and playback
   - Comprehensive debug logging system with color-coded categories
   - Proper cleanup and resource management

5. Smooth Audio Streaming Challenges & Solutions
   - Challenge: Audio playback had gaps and stutters when streaming chunks
   - Solutions implemented:
     a. Smart Buffering Strategy
        - Buffer threshold (2 chunks) before playback starts
        - Separate pending chunks queue for better management
        - 100ms ahead-of-time scheduling for smooth transitions
     b. Crossfading Implementation
        - 5ms crossfade between chunks to eliminate clicks/pops
        - Per-chunk gain nodes for precise volume control
        - Automated cleanup of audio nodes
     c. Precise Timing Control
        - Web Audio API's high-precision timing system
        - Calculated scheduling delays between chunks
        - Proper handling of chunk duration and transitions
     d. Resource Management
        - Efficient audio node lifecycle management
        - State synchronization between components
        - Memory leak prevention through proper cleanup

6. Speech Recognition Robustness
   - Challenge: Recognition system being triggered by agent's voice
   - Solutions implemented:
     a. Recognition Pause During Speech
        - Immediate abort of recognition when agent speaks
        - Clean session management for recognition restart
        - Proper state tracking for speaking/listening modes
     b. Recognition Recovery
        - Automatic session recreation after speech ends
        - Error recovery for various recognition failures
        - Graceful handling of silence and interruptions

7. Debug Infrastructure
   - Color-coded logging system for different operations
   - Real-time state visualization in UI
   - Audio frequency visualization for active monitoring
   - Comprehensive error tracking and reporting

visuals on the tldraw whiteboard:
[x] appropriately sized boxes (zoom factor, canvas size, text size)
[x] dark mode with more professional text

[x] working end to end of voice agent being informed by the chatbot plan
  - Integration between ChatBot and VoiceChat:
    1. Extended ChatBot class to:
      - Add method to get current tone and response for voice agent
      - Expose tone progression state for voice context
      - Handle voice transcript updates to conversation history
    2. Updated VoiceChat component to:
      - Initialize ChatBot instance and maintain it
      - Pass ChatBot responses to Eleven Labs conversation
      - Use ChatBot's tone information in voice responses
      - Update ChatBot context with voice transcript
    3. Message Flow:
      - User speaks → Web Speech API handles speech-to-text
      - Text sent to ChatBot for processing
      - ChatBot generates response with appropriate tone
      - Response sent to ElevenLabs for text-to-speech
      - Voice output plays while updating transcript
    4. State Management:
      - Synchronized ChatBot state with voice conversation
      - Maintained tone progression during voice interaction
      - Updated whiteboard visualization in real-time
    5. Error Handling:
      - Handled voice recognition errors gracefully
      - Maintained conversation state during reconnections
      - Provided fallback for failed TTS conversion
    6. Audio Streaming Optimization:
      - Implemented smart buffering for smooth playback
      - Added crossfading for seamless chunk transitions
      - Precise timing control for chunk scheduling
      - Efficient resource management and cleanup

[ ] integrate the voice chat into the chatbot
  - new sidebar view for the chatbot:
    - Button to pause/resume the voice chat (and timeline) -- that doubles as audio frequency visualizer into the chatpanel view.
    - turns between the user and the assistant (transcript) should be presented in a panel view on the right, below the button / audio frequency visualizer
  - chatpanel at the bottom should now contain a view of the latest refreshed:
    - constructed context (formatted context. that is sent to the AI)
    - the AI's last response (containing the tone progression, content, etc.)
    - (these may be json objects)
    - rendered as individual columns
  - we're mocking what it looks like to have recipient + agent -- normally that would be separate like in a phone call, and what the web ui is here is the driver's UI. But the purpose of having the transcript UI in there is to mock the "voice logs"


## TODO:
[ ] arrange only the future nodes past the timeline playhead, not past nodes
[ ] examine why x and y are being distributed even before the playhead, they should only be distributed after the playhead



set of ui updates for the chatbot:
[ ] update context view so that it's not a chat but rather shows the list of the past user's prompts
[ ] below it should be the ai's last response
[ ] and to the right should be the actual chat message history between the user and the ai


- prompting improvements:
  - agent shouldn't update the whiteboard state before the playhead
  - strategize tone progression in a more bipolar way to demonstrate the steering capabilities
  - generating the plan - should be timestamp and overall duration aware


- check mic permissions on page load

- driver chanigng whiteboaard should very clearly show the 
  - the mood words should be really jarring like a bipolar agent -- "blunt" etc (the point is that the agent might not do what you want, but it's not all, or nothing)
  - to show that behavior is very steerable -- for new people to ai
- demo script using the devpost text as seed and guide claude to do the most compelling things

Later:

[ ] documents ("planning for direction of information")  
[ ] voice conversation (state \+ web ui for voice)  

Other thoughts on why this is compelling:
- it's not openai operator because we're controlling the future of the agent's personality / context, not having it just observe what we do
- the elevenlabs api provides tool use, interruption detection, and KB insertion, but not the ability to influence conversational direction. So we need to implement that from scratch

## Innovation in Agent API Design

This project represents a novel approach to agent API design that fundamentally rethinks how we interact with conversational AI systems. Here's why this approach is particularly innovative:

### 1. Real-time Tone Control Protocol
Unlike traditional agent APIs that treat conversation as a simple request-response cycle, our system introduces a "Tone Control Protocol" that allows real-time steering of agent behavior:
- Dynamic tone progression planning through visual timeline
- Real-time adjustment of conversational direction
- Proactive tone state management based on conversation flow
- Bidirectional synchronization between UI state and agent behavior

### 2. Visual Programming for Conversation Flow
We're introducing a new paradigm of "Conversational Visual Programming":
- Tone nodes as visual programming primitives
- Spatial arrangement as semantic instruction
- Timeline-based execution model
- Real-time modification of program flow

### 3. Hybrid Control Architecture
Our system pioneers a hybrid approach to agent control:
- Combines deterministic visual programming with AI flexibility
- Maintains AI autonomy while enabling human oversight
- Balances structure with adaptability
- Enables "soft" intervention in agent behavior

### 4. Novel Integration with ElevenLabs
We're extending ElevenLabs' capabilities in innovative ways:
- Using voice modulation to reflect tone progression
- Integrating speech timing with tone transitions
- Synchronizing voice characteristics with emotional context
- Leveraging voice features for conversation pacing

### 5. State Management Innovation
Our approach to state management is particularly novel:
- Bidirectional sync between visual state and agent state
- Real-time propagation of state changes
- Persistent state across conversation lifecycle
- Visual representation of state transitions

### 6. Developer Experience Innovation
We're reimagining how developers interact with agent APIs:
- Visual debugging of conversation flow
- Real-time modification of agent behavior
- Immediate feedback loop for agent tuning
- Intuitive representation of complex state

### Why This Matters for ElevenLabs

1. **Enhanced Control**: Our approach demonstrates how ElevenLabs' voice technology can be more finely controlled through visual programming, opening new possibilities for voice application development.

2. **Developer Empowerment**: By making agent behavior visually programmable, we're making it easier for developers to create sophisticated voice applications without deep AI expertise.

3. **Real-world Applications**: This approach enables practical applications in:
   - Therapeutic conversations with controlled emotional progression
   - Educational dialogues with planned learning curves
   - Customer service with precise tone management
   - Professional consulting with strategic conversation planning

4. **Platform Extension**: Our project shows how ElevenLabs' platform can be extended beyond basic voice synthesis to support complex conversational applications.

5. **Future Potential**: This approach lays groundwork for:
   - Visual conversation design tools
   - Real-time voice application debugging
   - Collaborative voice app development
   - Advanced conversation flow control

### Technical Innovation

The core technical innovations include:

1. **Model Context Protocol (MCP)**:
   - Bridges visual programming with AI behavior
   - Enables real-time state synchronization
   - Provides deterministic control over non-deterministic AI
   - Maintains conversation coherence during modifications

2. **Tone Progression Engine**:
   - Real-time tone state management
   - Predictive tone transition planning
   - Dynamic adjustment based on conversation flow
   - Visual feedback of tone state

3. **State Synchronization System**:
   - Bidirectional state propagation
   - Real-time UI updates
   - Persistent state management
   - Visual state debugging

4. **Voice Integration Layer**:
   - Tone-aware voice modulation
   - Real-time voice parameter adjustment
   - Synchronized state transitions
   - Integrated interruption handling

This project represents a significant step forward in making agent APIs more accessible, controllable, and practical for real-world applications. It demonstrates how ElevenLabs' technology can be extended to support more sophisticated use cases while maintaining ease of use and developer productivity.

### From an AI Developer's Perspective

As an AI developer, I've always been frustrated by the gap between what we promise with conversational AI and what we actually deliver. We talk about natural, flowing conversations, but what we usually build are glorified call-and-response systems. The problem isn't just technical - it's architectural. We've been thinking about agent APIs all wrong.

When I first started working with the ElevenLabs API, I was impressed by its voice synthesis capabilities, but I kept running into the same wall that all conversational systems hit: the rigidity of the interaction model. Sure, we could generate incredibly natural-sounding speech, but the conversation flow itself remained mechanical. That's when it hit me - we needed to stop thinking about conversation as a series of API calls and start thinking about it as a dynamic, visual program.

What excites me most about this project is how it fundamentally changes the way we think about building conversational agents. Instead of writing code to handle conversation states, I'm literally drawing them. I can see the conversation flow laid out in front of me, manipulate it in real-time, and watch as the agent adapts its behavior. It's like having a visual IDE for conversation design.

The real breakthrough came when we realized we could use the whiteboard not just as a visualization tool, but as an actual programming interface. Each tone node becomes a kind of visual function, the timeline becomes our execution flow, and the spatial relationships between nodes become our control logic. But unlike traditional visual programming, this interface is dynamic - it responds and adapts as the conversation evolves.

What's particularly powerful is how this approach bridges the gap between deterministic programming and AI flexibility. As a developer, I can set up the broad strokes of the conversation flow - the key topics, the tone progressions, the major transitions - but the AI still has the freedom to handle the moment-to-moment interactions naturally. It's like having the best of both worlds: the predictability of traditional programming with the adaptability of AI.

The integration with ElevenLabs' voice technology takes this to another level. We're not just controlling what the agent says, but how it says it. The tone nodes don't just influence the content of the response; they directly shape the voice characteristics, creating a seamless connection between conversation planning and voice delivery. This is what truly natural conversation should feel like - a fluid combination of planned direction and spontaneous adaptation.

For me, the most exciting part is thinking about where this could go. Imagine collaborative conversation design tools where multiple developers can work together to craft complex interaction flows. Or visual debugging tools that let you step through a conversation like you would step through code, but with real-time voice output. We could even create marketplaces for conversation patterns, where developers share and reuse successful conversation flows.

This isn't just a new way to build conversational AI - it's a new way to think about AI development itself. We're moving from a world of rigid APIs and prompt engineering to one of visual conversation design and real-time control. And with ElevenLabs' technology as the foundation, we're not just imagining this future - we're building it.

(need to edit more, still very fluffy)