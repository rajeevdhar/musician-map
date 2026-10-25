import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const TOUR_KEY = 'mm_tour_v1'

export function hasSeenTour() {
  try { return !!localStorage.getItem(TOUR_KEY) } catch { return false }
}

export function markTourSeen() {
  try { localStorage.setItem(TOUR_KEY, '1') } catch { /* */ }
}

export function startTour(onDone?: () => void) {
  const d = driver({
    animate: true,
    showProgress: true,
    showButtons: ['next', 'previous', 'close'],
    nextBtnText: 'Next →',
    prevBtnText: '← Back',
    doneBtnText: 'Done',
    progressText: '{{current}} of {{total}}',
    onDestroyStarted: () => {
      markTourSeen()
      d.destroy()
      onDone?.()
    },
    steps: [
      {
        element: '[data-tour="map"]',
        popover: {
          title: 'The map',
          description: 'Musicians near you appear as pins. Click any pin to view their profile, instruments, and contact details.',
          side: 'top',
          align: 'start',
        },
      },
      {
        element: '[data-tour="filters"]',
        popover: {
          title: 'Filter by instrument',
          description: 'Click an instrument to show only those musicians. You can combine multiple filters.',
          side: 'bottom',
          align: 'start',
        },
      },
      {
        element: '[data-tour="search"]',
        popover: {
          title: 'Search',
          description: 'Search by name, instrument, genre, or city to find exactly who you need.',
          side: 'bottom',
          align: 'center',
        },
      },
      {
        element: '[data-tour="saved"]',
        popover: {
          title: 'Save musicians',
          description: 'Bookmark musicians you want to follow up with. Add private notes to help you remember.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '[data-tour="messages"]',
        popover: {
          title: 'Direct messages',
          description: 'Send a direct message to any musician. New messages show a red dot here.',
          side: 'bottom',
          align: 'end',
        },
      },
      {
        element: '[data-tour="profile-btn"]',
        popover: {
          title: 'Your profile',
          description: "Edit your profile, add a photo, gear, social links, and more. The fuller your profile, the more connections you'll make.",
          side: 'bottom',
          align: 'end',
        },
      },
    ],
  })

  d.drive()
}
