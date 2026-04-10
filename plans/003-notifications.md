# Plan 003 - Notifications

## Adding Notifications For Timers

Currently the timers work well, but when they run out, there is not alert to the user, especially if the browser is not in focus. You need to add browser notifications whenever the timer reaches zero. Along with the browser notification, there should be a sound played so the user knows the timer ended.

When the page first loads, permissions for browser notifications should be requested by the user. If the user gives permission, show the notification on timer end, but if not, just play the sound by itself.

## Timer End Sound

When the timer ends, you should generate an alarm sound using the Web Audio API. The sound should get the user's attention, but shouldn't be very harsh. Ideally, it should utilize harmonics for a pleasing sound that isn't jarring. When playing the sound, it should only beep four times before ending.

## Test Notifications Button

A "Test Notifications" button should be permanently visible in the bottom-left corner of the page. When clicked, it should trigger the alarm sound and send a browser notification exactly as if a work timer had ended naturally. This allows users to verify their notification settings are working without waiting for a timer to complete.