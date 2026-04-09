# Plan 001 - Initial Setup

## Application Overview

Tomato Master is a online task tracker with a Pomodoro timer built-in. It should have a simple but beautiful UI that allows a user to enter their tasks, start a timer, see the current task they are working with, and enter notes to let them continue with context after a break.

## Note Taking

When the user finishes their work period, they should be presented with a modal input text box. This box should prompt them to enter a brief note explaining what they are working on. The purpose is to give them context to continue back in the flow when the break is over.

Once the note is entered and the break completes, the note will be shown again as a note on the page when the work timer starts back. It should be shown promimently so the user can be reminded of their work context.

## Timers

The app uses standard Pomodoro timers: 25 minutes for work, 5 minutes for short break, and 15 minutes for long break.

When a timer runs out, it should not automatically start another timer. Starting any of the timers should be manually handled by the user. Just present the timers as individual buttons they can press.

The user should be able to pause and cancel running timers. If they cancel a work timer, the note context modal should still show as if the timer ran out naturally.

## UI Design

The UI must be a modern UI with material design. Use simple colors with a soft red tomato theme (no harsh red colors).

Use subtle CSS animations to add polish to the design and make it feel alive.

The timer on the page should be shown prominently along with the buttons to control the timer underneath.
