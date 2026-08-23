import type { MetadataRoute } from 'next'

// Nothing here is public. The app is one route behind a sign-in, so there is no
// page a search engine could usefully rank — only the shell, the product name
// and the fact that this exists, which is not something to publish before the
// first customer is live.
//
// The unfurl bots are allowed through on purpose. When the URL is pasted into
// WhatsApp or a DM, those crawlers fetch it to build the link preview, and
// Twitterbot in particular honours robots.txt — a blanket Disallow would turn
// every shared link into a bare grey rectangle. facebookexternalhit covers
// WhatsApp and Messenger, which is how this actually gets sent to people.
//
// WHEN THE LANDING PAGE SHIPS: delete the catch-all Disallow below and give
// the marketing routes an Allow. Leaving this file as-is would keep the new
// page out of Google, which is the exact opposite of what a landing page is.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: ['facebookexternalhit', 'Twitterbot', 'WhatsApp', 'Slackbot-LinkExpanding', 'LinkedInBot'],
        allow: '/',
        disallow: '/api/',
      },
      {
        userAgent: '*',
        disallow: '/',
      },
    ],
  }
}
