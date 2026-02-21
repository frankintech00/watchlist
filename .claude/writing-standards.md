# Writing Standards -- Data Platform Projects

## Language Requirements

### UK English Mandatory

All code comments, documentation, commit messages, and written content
must use UK English spelling and conventions.

#### Common UK vs US Differences

**Spelling**

- organisation (not organization)
- colour (not color)
- behaviour (not behavior)
- analyse (not analyze)
- licence (noun), license (verb)
- practise (verb), practice (noun)
- centre (not center)
- metre (measurement)
- fulfil
- travelled, modelling, labelled
- recognise, authorise
- defence
- grey

**Date Format**

- DD/MM/YYYY (e.g. 31/10/2025)
- ISO: YYYY-MM-DD (e.g. 2025-10-31)

**Terminology**

- postcode (not zip code)
- council tax (not property tax)
- programme (initiative), program (code)
- whilst acceptable alongside while

## Natural Writing Style

### Eliminate AI Patterns

Avoid language that signals automated writing.

Do not use:

- "Let's"
- "Here's"
- "I'll / We'll" in technical writing
- Emoji or decorative symbols
- "Note:" / "Important:" prefixes
- Exclamation marks
- Over-enthusiastic tone
- Conversational filler

### Be Direct and Concise

Write like someone who maintains the system.

Avoid:

- Over-explaining obvious behaviour
- Marketing language
- Softening language
- Restating what the code already shows

Prefer:

- Plain statements
- Explanations of intent
- Domain terms
- Practical tone

## Comment Style

### Complex Logic

Explain context and reasoning.

### Non-obvious Behaviour

Explain side-effects or edge cases.

### Workarounds and Data Issues

Document why they exist.

## Documentation Style

Documentation should read like internal engineering notes.

### Function Docstrings

Natural and factual.

### Project Documentation

Use clear sections and direct language.

## Commit Messages

Commits describe what changed.

### Format

- Short
- Factual
- Present tense
- No prefixes

## Variable and Function Naming

Names should reflect domain meaning.

## Log Messages

Logs should support troubleshooting.

## Error Messages

Errors must tell the engineer what failed and where.

## Technical Writing Principles

1.  Be specific
2.  Be brief
3.  Be factual
4.  Be consistent
5.  Be direct

## Red Flags

Revise if writing contains:

- "Here's"
- "Let's"
- "Simply"
- "Just"
- "Easy"
- "Powerful"
- "Robust"
- "Leverages"
- "Utilises"
- "In order to"
- "Please note"
- "It's important to"

## Quick Checklist

- UK English used consistently
- No conversational phrasing
- No emoji or exclamation marks
- No em dashes
- Comments explain intent
- Tone is professional and neutral
- Domain terms used correctly
- Logs are clear and minimal
- Errors are actionable
- Commit message is factual

## Core Principle

Write as if:

- You will maintain this in two years
- You are tired
- The system is broken
- Someone else must fix it quickly

Clarity beats cleverness. Every time.
