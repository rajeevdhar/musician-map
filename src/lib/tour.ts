import { driver } from 'driver.js'
import 'driver.js/dist/driver.css'

const TOUR_KEY = 'mm_tour_v1'

export function hasSeenTour() {
  try { return !!localStorage.getItem(TOUR_KEY) } catch { return false }
}

export function markTourSeen() {
  try { localStorage.setItem(TOUR_KEY, '1') } catch { /* */ }
}

function isMobile() {
  return window.innerWidth < 1024
}

export function startTour(onDone?: () => void) {
  const mobile = isMobile()

  const steps = mobile ? [
    {
      element: '[data-tour="map"]',
      popover: {
        title: 'The map',
        description: 'Musicians near you appear as pins. Tap any pin to view their profile, instruments, and contact details.',
        side: 'top' as const,
        align: 'start' as const,
      },
    },
    {
      element: '[data-tour="mobile-search"]',
      popover: {
        title: 'Search',
        description: 'Search by name, instrument, genre, or city to find exactly who you need.',
        side: 'bottom' as const,
        align: 'center' as const,
      },
    },
    {
      element: '[data-tour="mobile-filters"]',
      popover: {
        title: 'Filter musicians',
        description: 'Tap here to filter by instrument, genre, experience level, and more.',
        side: 'bottom' as const,
        align: 'end' as const,
      },
    },
    {
      element: '[data-tour="nav-saved"]',
      popover: {
        title: 'Save musicians',
        description: 'Bookmark musicians you want to follow up with. Add private notes to help you remember.',
        side: 'top' as const,
        align: 'center' as const,
      },
    },
    {
      element: '[data-tour="nav-messages"]',
      popover: {
        title: 'Direct messages',
        description: 'Send a direct message to any musician. New messages show a red dot here.',
        side: 'top' as const,
        align: 'center' as const,
      },
    },
    {
      element: '[data-tour="nav-me"]',
      popover: {
        title: 'Your profile',
        description: "Edit your profile, add a photo, gear, social links, and more. The fuller your profile, the more connections you'll make.",
        side: 'top' as const,
        align: 'center' as const,
      },
    },
  ] : [
    {
      element: '[data-tour="map"]',
      popover: {
        title: 'The map',
        description: 'Musicians near you appear as pins. Click any pin to view their profile, instruments, and contact details.',
        side: 'top' as const,
        align: 'start' as const,
      },
    },
    {
      element: '[data-tour="filters"]',
      popover: {
        title: 'Filter by instrument',
        description: 'Click an instrument to show only those musicians. You can combine multiple filters.',
        side: 'bottom' as const,
        align: 'start' as const,
      },
    },
    {
      element: '[data-tour="search"]',
      popover: {
        title: 'Search',
        description: 'Search by name, instrument, genre, or city to find exactly who you need.',
        side: 'bottom' as const,
        align: 'center' as const,
      },
    },
    {
      element: '[data-tour="saved"]',
      popover: {
        title: 'Save musicians',
        description: 'Bookmark musicians you want to follow up with. Add private notes to help you remember.',
        side: 'bottom' as const,
        align: 'end' as const,
      },
    },
    {
      element: '[data-tour="messages"]',
      popover: {
        title: 'Direct messages',
        description: 'Send a direct message to any musician. New messages show a red dot here.',
        side: 'bottom' as const,
        align: 'end' as const,
      },
    },
    {
      element: '[data-tour="profile-btn"]',
      popover: {
        title: 'Your profile',
        description: "Edit your profile, add a photo, gear, social links, and more. The fuller your profile, the more connections you'll make.",
        side: 'bottom' as const,
        align: 'end' as const,
      },
    },
  ]

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
    steps,
  })

  d.drive()
}
