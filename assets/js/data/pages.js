/* ASM 2027 data component — page availability.
   Set a page to false to replace its content with a "Details will be announced later" notice.
   Paths are relative to the site root (the folder containing index.html).
   The notice text can be changed below. */
window.ASM_DATA_PAGES = {
  "defaultActive": true,
  "notice": {
    "title": "Details will be announced later",
    "text": "This page is being prepared. Please check back soon."
  },
  "pages": {
    "index.html": true,                          // Home
    "404.html": true,                            // Page not found
    "pages/academic-accreditation.html": false,   // Academic accreditation
    "pages/accessibility.html": true,            // Accessibility
    "pages/accommodation.html": true,            // Accommodation
    "pages/app.html": true,                      // Event app
    "pages/call-for-abstracts.html": true,       // Call for Submission
    "pages/call-for-eposter.html": true,         // Call for e-Posters
    "pages/call-for-formal-project.html": true,   // Call for formal projects
    "pages/college-ceremony.html": true,          // College ceremony
    "pages/committees.html": true,                // Committees
    "pages/contact-us.html": true,                // Contact us
    "pages/cpd.html": true,                       // CME/CPD and certificates
    "pages/e-posters.html": true,                 // Free paper and e-Poster
    "pages/event.html": true,                     // Event information
    "pages/explore-hong-kong.html": true,         // Explore Hong Kong
    "pages/faculty.html": false,                   // Faculty
    "pages/faqs.html": false,                      // FAQs
    "pages/formal-project-prize.html": true,      // Formal Project Prize
    "pages/meeting-information.html": true,       // Meeting information
    "pages/news.html": true,                      // News
    "pages/ondemand.html": true,                  // OnDemand
    "pages/our-sponsors.html": false,              // Our sponsors
    "pages/past-asm.html": true,                  // Past ASM
    "pages/privacy.html": true,                   // Privacy
    "pages/programme.html": true,                 // Programme
    "pages/registration.html": false,              // Registration
    "pages/search.html": true,                    // Search
    "pages/slot-qr.html": true,                   // Session stamp QR
    "pages/social-functions.html": true,          // Social functions
    "pages/sponsor-application.html": false,       // Sponsor application
    "pages/sponsorship-exhibition.html": false,    // Sponsorship and exhibition
    "pages/terms.html": true,                     // Terms and conditions
    "pages/travel-visa.html": true                // Travel and visa
  }
};
