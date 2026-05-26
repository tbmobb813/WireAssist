# Multi-Model Intelligent Routing

## Overview

Linux AI Assistant features **Intelligent Model Routing** - an automatic system that selects the optimal AI model for each query based on:

- **Query Intent**: Code generation, debugging, explanation, creative writing, etc.
- **Project Context**: Detects project type (Rust, Python, Node.js, etc.) and routes to models that excel at that language
- **Complexity**: Routes simple queries to faster/cheaper models, complex queries to premium models
- **Cost Optimization**: Saves money by using free/cheaper models when appropriate
- **User Preferences**: Manual override always available

## Key Features

### 🎯 Smart Query Classification

The system automatically detects what you're trying to do:

- **Code Generation**: "create a function that...", "implement a class..."
- **Debugging**: "fix this error", "why isn't this working"
- **Code Explanation**: "explain how this works", "what does this do"
- **Refactoring**: "improve this code", "optimize this function"
- **Architecture**: "design a system for...", "what's the best pattern"
- **General Questions**: Simple queries, quick answers

### 🦀 Language-Aware Routing

Models are matched to your project type:

| Language              | Preferred Model               | Why                                                  |
| --------------------- | ----------------------------- | ---------------------------------------------------- |
| Rust, C++             | Claude 3.5 Sonnet             | Excels at systems programming, complex logic         |
| Python                | GPT-4o                        | Strong general-purpose model, great for data science |
| JavaScript/TypeScript | GPT-4o                        | Excellent for web development                        |
| Go, Java              | Gemini 1.5 Pro                | Good performance for enterprise languages            |
| Simple queries        | GPT-3.5 Turbo or Gemini Flash | Fast and economical                                  |

### 💰 Cost Optimization

Automatic cost savings based on query complexity:

- **Free Tier**: Gemini 1.5 Flash for simple explanations and general questions
- **Economy**: GPT-3.5 Turbo for straightforward tasks
- **Balanced** (default): Mix of models based on need
- **Quality**: Premium models for complex work

**Example Savings**:

- Simple "explain this code" query: $0.003 saved vs always using Claude
- Data analysis task routed to GPT-4o: Same quality, 40% cheaper than Claude
- Estimated monthly savings: $10-30 depending on usage

## How It Works

### Routing Flow

```
User Query
    ↓
Query Classification
    ├─ Type (code_generation, debugging, etc.)
    ├─ Complexity (simple, medium, complex)
    └─ Token estimate
    ↓
Project Detection
    └─ Language/framework (Rust, Python, Node, etc.)
    ↓
Model Scoring
    ├─ Capability match
    ├─ Language expertise
    ├─ Cost preference
    └─ Complexity handling
    ↓
Route to Optimal Model
    ↓
Track Analytics
```

### Query Classification Examples

**Code Generation**:

```
"Create a function that parses JSON"
→ Type: code_generation, Complexity: medium
→ Routes to: Claude 3.5 Sonnet (if Rust) or GPT-4o
```

**Debugging**:

```
"Fix this error: cannot borrow as mutable"
→ Type: debugging, Complexity: medium, hasErrorContext: true
→ Routes to: Claude 3.5 Sonnet (Rust expert)
```

**Simple Explanation**:

```
"What is a HashMap?"
→ Type: code_explanation, Complexity: simple
→ Routes to: GPT-3.5 Turbo or Gemini Flash (cost-effective)
```

**Complex Architecture**:

```
"Design a distributed caching system"
→ Type: architecture, Complexity: complex
→ Routes to: Claude 3.5 Sonnet (excels at reasoning)
```

## Model Capabilities

### Claude 3.5 Sonnet

- **Strengths**: Rust, C++, systems programming, complex reasoning, architecture
- **Cost**: High ($0.003/1K tokens output)
- **Best For**: Complex code generation, debugging Rust/systems code, architectural design
- **Context**: 200K tokens

### GPT-4o

- **Strengths**: Python, JavaScript, general-purpose, creative writing, multimodal
- **Cost**: High ($0.0015/1K tokens output)
- **Best For**: Web development, data science, general programming
- **Context**: 128K tokens

### GPT-4o Mini

- **Strengths**: Fast, efficient, balanced cost/quality
- **Cost**: Medium ($0.0006/1K tokens output)
- **Best For**: Code explanations, medium complexity tasks
- **Context**: 128K tokens

### GPT-3.5 Turbo

- **Strengths**: Very fast, economical, good for simple tasks
- **Cost**: Low ($0.0005/1K tokens output)
- **Best For**: Simple questions, quick explanations
- **Context**: 16K tokens

### Gemini 1.5 Flash

- **Strengths**: FREE, fast, multimodal, huge context
- **Cost**: Free (with limits)
- **Best For**: General questions, code explanations, simple tasks
- **Context**: 1M tokens

### Gemini 1.5 Pro

- **Strengths**: Large context, multimodal, reasoning
- **Cost**: Medium ($0.00125/1K tokens output)
- **Best For**: Complex queries, large codebases, long documents
- **Context**: 2M tokens

## User Interface

### Routing Indicator

The routing indicator appears in the chat input area:

```
┌─────────────────────────────────────┐
│ 🤖 Claude • Rust project            │ ← Shows selected model + reason
└─────────────────────────────────────┘
```

Click the indicator to:

- See full routing decision with confidence score
- View alternative model options
- Manually override to different model
- See estimated cost savings

### Manual Override

To override automatic routing:

1. Click the routing indicator
2. Select your preferred model from dropdown
3. Model is marked with blue "Override" badge
4. Click again to remove override and return to auto-routing

### Routing Info Display

When you expand the routing dropdown, you see:

- **Recommended**: Green badge on auto-selected model
- **Override**: Blue badge if you manually selected
- **Cost Tier**: Color-coded badges (green=free, blue=low, yellow=medium, purple=high)
- **Context Window**: How much context each model can handle
- **Strengths**: Top capabilities of each model
- **Routing Info**: Why the model was selected, confidence score, estimated savings

## Settings

### Enable/Disable Routing

Settings → Intelligent Routing → Enable Auto-Routing

When disabled, uses your default model from Settings.

### Cost Preference

Three modes to balance cost vs quality:

**Economy Mode**:

- Prefers free/cheap models (Gemini Flash, GPT-3.5)
- Only uses premium models for complex queries
- Maximum cost savings

**Balanced Mode** (Default):

- Smart mix based on query complexity
- Uses premium models when needed
- Good savings while maintaining quality

**Quality Mode**:

- Prefers premium models (Claude, GPT-4o)
- Uses top models for most queries
- Minimum cost savings, maximum quality

### Language Preferences

Override routing for specific languages:

Settings → Intelligent Routing → Language Preferences

Example:

- Always use Claude for Rust
- Always use GPT-4o for Python
- Let routing decide for others

### Advanced Settings

- **Min Confidence**: Only auto-route if confidence > 70% (default)
- **Fallback Model**: Model to use when routing uncertain (default: GPT-4o)
- **Allow Downgrade**: Use cheaper models for simple queries (default: yes)
- **Track Performance**: Record routing decisions for analytics (default: yes)

## Analytics

View routing performance in the Performance Dashboard:

### Cost Savings

- Total estimated savings: $XX.XX
- Savings this month: $X.XX
- Average savings per query: $0.XX

### Model Usage

- Claude 3.5 Sonnet: 35%
- GPT-4o: 28%
- GPT-4o Mini: 20%
- Gemini Flash: 12%
- GPT-3.5 Turbo: 5%

### Query Types

- Code Generation: 40%
- Debugging: 25%
- Code Explanation: 20%
- General Questions: 10%
- Other: 5%

### Routing Accuracy

- High confidence (>90%): 65%
- Medium confidence (70-90%): 25%
- Low confidence (<70%): 10% (used fallback)

## Best Practices

### When to Use Manual Override

✅ **Good reasons to override**:

- You know a specific model performs better for your use case
- Testing different models for comparison
- Working on a task that requires a specific model's unique capabilities

❌ **Avoid overriding when**:

- You're not sure which model is best
- The auto-routing already selected a premium model
- You're just trying to save money (use Economy mode instead)

### Optimizing Costs

1. **Use Economy Mode** for non-critical work
2. **Let routing decide** - it's smarter than always using one model
3. **Check analytics** to see where your money goes
4. **Use language preferences** to lock in best models per language

### Getting Best Results

1. **Be specific in queries** - helps classification
2. **Mention language/framework** if routing misses it
3. **Use error detection** - automatically adds context for better routing
4. **Include code in backticks** - helps routing detect code-heavy queries

## Technical Details

### Scoring Algorithm

Models are scored (0-100) based on:

- **Query Type Match** (+30): Does model excel at this type?
- **Complexity Match** (+25): Can model handle this complexity?
- **Language Match** (+20): Model's expertise in project language
- **Strength Match** (+15): Does query match model's strengths?
- **Context Fit** (+5): Query fits in model's context window
- **Cost Preference** (-10 to +20): Adjusted by economy/balanced/quality setting
- **Continuity Bonus** (+10): Same as previous if it was good

Highest scoring model is selected, if confidence > min threshold.

### Confidence Calculation

Confidence = min(topScore / 100, 1.0)

- High (>90%): Strong match, use with confidence
- Medium (70-90%): Good match, but consider alternatives
- Low (<70%): Uncertain, use fallback model

### Fallback Behavior

Routing falls back to default model when:

- Confidence < min threshold (default 70%)
- Project type detection fails
- Routing service throws error
- User disables auto-routing

## Examples

### Example 1: Rust Error Debugging

**Query**: "Fix this Rust error: cannot move out of borrowed content"

**Classification**:

- Type: debugging
- Complexity: medium
- hasErrorContext: true

**Context**:

- Project: Rust
- hasCodeContext: true

**Routing Decision**:

- Selected Model: Claude 3.5 Sonnet
- Reasoning: "Best for: Rust project, debugging"
- Confidence: 95%
- Alternatives: GPT-4o (score: 65), Gemini Pro (score: 55)
- Cost Savings: $0 (using premium model appropriately)

### Example 2: Simple Python Question

**Query**: "What's the difference between a list and a tuple?"

**Classification**:

- Type: code_explanation
- Complexity: simple
- hasErrorContext: false

**Context**:

- Project: Python
- hasCodeContext: false

**Routing Decision**:

- Selected Model: Gemini 1.5 Flash
- Reasoning: "Best for: cost optimized"
- Confidence: 88%
- Alternatives: GPT-3.5 Turbo (score: 75), GPT-4o Mini (score: 70)
- Cost Savings: $0.003 (vs Claude)

### Example 3: Complex Architecture Design

**Query**: "Design a microservices architecture for an e-commerce platform with event sourcing"

**Classification**:

- Type: architecture
- Complexity: complex
- tokensEstimate: 3500

**Context**:

- Project: Node.js
- conversationLength: 15 messages

**Routing Decision**:

- Selected Model: Claude 3.5 Sonnet
- Reasoning: "Best for: complex query, architecture"
- Confidence: 92%
- Alternatives: GPT-4o (score: 85), Gemini Pro (score: 75)
- Cost Savings: $0 (complex query needs premium model)

## Troubleshooting

### Routing Not Working

**Symptoms**: Always uses default model, no routing indicator

**Solutions**:

1. Check Settings → Enable Auto-Routing is ON
2. Verify you have API keys for multiple providers
3. Check console for routing errors
4. Clear routing store cache: Settings → Advanced → Clear Routing Cache

### Wrong Model Selected

**Symptoms**: Routing picks suboptimal model

**Solutions**:

1. Add more context to your query (mention language, complexity)
2. Use manual override for this query
3. Set language preference: Settings → Routing → Language Preferences
4. Adjust cost preference (Economy → Balanced or Quality)

### High Costs Despite Routing

**Symptoms**: Not saving money as expected

**Solutions**:

1. Check Analytics → Model Usage (are you using premium models too much?)
2. Switch to Economy mode for routine queries
3. Set language preferences to use cheaper models
4. Review query types - complex queries need premium models

## Competitive Advantage

### vs Claude Desktop / ChatGPT

✅ **Linux AI Assistant**:

- Automatic model switching based on task
- Cost optimization built-in
- Language-aware routing
- Project context integration
- Transparent decision reasoning
- Estimated cost savings tracking

❌ **Claude Desktop / ChatGPT**:

- Single model per conversation
- No automatic switching
- No cost optimization
- Manual model selection only
- No project awareness
- No savings tracking

### Cost Comparison

**Scenario**: 100 queries per month

| Service                 | Monthly Cost | Notes                      |
| ----------------------- | ------------ | -------------------------- |
| Always Claude           | $15.00       | Premium quality, expensive |
| Always ChatGPT Plus     | $20.00       | Subscription fee           |
| **Linux AI w/ Routing** | **$5-8**     | Automatic optimization     |
| Always Gemini Flash     | $0.00        | Free but limited quality   |

**Savings**: $7-10/month with intelligent routing vs always using premium models.

## Future Enhancements

Planned improvements:

- [ ] **Performance-based routing**: Learn which models work best for each query type
- [ ] **User feedback**: Rate responses to improve routing decisions
- [ ] **Context-aware caching**: Cache routing decisions for similar queries
- [ ] **Team preferences**: Share routing settings across team
- [ ] **Cost budgets**: Set spending limits, auto-switch to economy mode
- [ ] **A/B testing**: Compare model responses automatically
- [ ] **Streaming cost estimation**: Show real-time cost during generation
- [ ] **Model health monitoring**: Detect and avoid slow/failing models

## API Reference

### Types

```typescript
// Query classification result
interface QueryClassification {
  type: QueryType;
  complexity: "simple" | "medium" | "complex";
  requiresContext: boolean;
  tokensEstimate: number;
}

// Routing decision
interface RoutingDecision {
  modelId: string;
  reasoning: string;
  confidence: number;
  alternatives: Array<{ modelId: string; score: number }>;
  costSavings?: number;
}

// Routing context
interface RoutingContext {
  query: string;
  projectType?: string;
  conversationLength: number;
  hasCodeContext: boolean;
  hasErrorContext: boolean;
  previousModel?: string;
  userPreference?: string;
}
```

### Functions

```typescript
// Classify a query
function classifyQuery(
  query: string,
  context: RoutingContext,
): QueryClassification;

// Select optimal model
function selectOptimalModel(
  context: RoutingContext,
  settings: RoutingSettings,
): RoutingDecision;

// Format routing decision for display
function formatRoutingDecision(decision: RoutingDecision): string;
```

## Conclusion

Intelligent Model Routing is a **killer feature** that sets Linux AI Assistant apart from competitors. It provides:

✅ **Better Results**: Right model for each task
✅ **Lower Costs**: Automatic optimization saves $7-10/month
✅ **Transparency**: See why each model was selected
✅ **Flexibility**: Manual override always available
✅ **Project Awareness**: Considers your codebase context

Enable it in Settings and let the AI choose the best AI! 🎯
