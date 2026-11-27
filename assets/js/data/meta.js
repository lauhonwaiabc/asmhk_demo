/* ASM 2027 - single source for event facts.
   Dates are stored once. Display labels, day names and the e-Programme
   "Available" line are derived below. Edit this file, then run
   `node tools/apply-shell.js`. */
window.ASM_DATA_META = {
  meta: {
    event: {
      name: "Annual Scientific Meeting in Anaesthesiology 2027",
      shortName: "ASM 2027",
      theme: "Anaesthesia Intelligence",
      city: "Hong Kong",
      language: "English",
      mode: "In person / Video on Demand",
      website: "https://asmhk.org/",
      hashtag: "#ASM27HK",
      start: "2027-10-30",
      end: "2027-10-31",
      themeTagline: "Intelligence in anaesthesia is not only artificial.",
      themeIntro: "The 2027 theme looks beyond the technology cycle. Artificial intelligence is entering monitoring, decision support and education, but its value depends on the clinical intelligence of the people and systems around it. The meeting will examine what is ready for practice, what still needs evidence, and how we keep judgement at the centre of care.",
      biosPublished: false,
      organisers: [
        { "name": "The Hong Kong College of Anaesthesiologists", "url": "https://www.hkca.edu.hk/" },
        { "name": "The Society of Anaesthetists of Hong Kong", "url": "http://sahk.hk/" }
      ]
    },
    venue: {
      name: "Hopewell Hotel",
      building: "Crystal Court, 19/F and Salons, 20/F",
      street: "15 Kennedy Road, Wan Chai, Hong Kong",
      tel: "(852) 2620 3000",
      website: "www.hopewellhotel.com",
      mapUrl: "https://maps.google.com/?q=Hopewell+Hotel,+15+Kennedy+Road,+Wan+Chai,+Hong+Kong",
      mapEmbed: "https://www.google.com/maps/embed?origin=mfe&pb=!1m3!2m1!1sHopewell+Hotel,+15+Kennedy+Road,+Wan+Chai,+Hong+Kong!6i16",
      parking: {
        name: "Hopewell Mall Carpark",
        entrance: "15 Kennedy Road, Hong Kong Island (car park exit)",
        details: "https://www.hopewellhill.com.hk/parking",
        note: "There is a public car park on 14/F to 16/F (operated by Hopewell Mall) in the same building. Parking fees apply."
      },
      preConference: {
        venue: "Salon, 20/F, Crystal Court, Hopewell Hotel"
      }
    },
    registration: {
      opens: "1 June 2027",
      earlyBirdDeadline: "29 September 2027"
    },
    eProgramme: {
      date: "22 October 2027",
      book: ""
    },
    ePosterFreePaper: {
      abstractDeadline: "31 August 2027",
      notification: "Mid-September 2027",
      presentingDeadline: "30 September 2027",
      fileDeadline: "15 October 2027",
      evaluation: {
        time: "14:00–15:30",
        venue: "Pre-function area, 20/F"
      },
      freePaper: {
        time: "11:00–12:30",
        venue: "Salon 1–2, 20/F"
      },
      presentationShortlist: "Up to 5",
      presentationOptOut: "At submission"
    },
    formalProject: {
      dates: [
        { "label": "Formal Project submission", "date": "HKCA deadline", "note": "Follow the College's Formal Project timeline" },
        { "label": "Internal audit and Officer review", "date": "After submission", "note": "Completeness, eligibility and assessment record" },
        { "label": "Invitation to present", "date": "By invitation", "note": "Issued by the Scientific Programme Committee" },
        { "label": "Formal Project Prize Session", "date": "30 October 2027", "note": "16:00–17:30, Salon 3–4" }
      ]
    },
    social: {
      functions: [
        {
          "id": "annual-dinner",
          "name": "Conference / Congregation Dinner",
          "date": "30 October 2027",
          "time": "(Pending Confirmation)",
          "venue": "Crystal Court I, 19/F, Hopewell Hotel, Hong Kong",
          "price": "",
          "dress": "",
          "status": "confirmed",
          "note": "One complimentary ticket is included for ASM registrants; eligibility is set out in the registration terms.",
          "image": "images/congregation-dinner.jpg",
          "imageAlt": "The ASM Congregation Dinner in Crystal Court"
        },
        {
          "id": "faculty-dinner",
          "name": "ASM Faculty Dinner",
          "date": "29 October 2027",
          "time": "(Pending Confirmation)",
          "venue": "(Pending Confirmation)",
          "price": "",
          "dress": "",
          "status": "confirmed",
          "note": "By invitation for faculty and the Organising Committee.",
          "image": "images/faculty-dinner.jpg",
          "imageAlt": "The ASM Faculty Dinner room set for dinner"
        }
      ]
    },
    ceremony: {
      details: {
        "date": "30 October 2027",
        "time": "18:00–19:30",
        "venue": "Crystal Court II, 19/F, Hopewell Hotel, Hong Kong",
        "photoBooth": "Pre-function area, 20/F, Hopewell Hotel, Hong Kong",
        "photoBoothArea": "Pre-function area",
        "photoBoothFloor": "20/F"
      },
      dinner: {
        "date": "30 October 2027",
        "time": "19:30",
        "venue": "Crystal Court I, 19/F, Hopewell Hotel, Hong Kong"
      },
      "gownCollection": "Salon 1, 20/F",
      "guestsSeatedBy": "the published time",
      "schedule": [
      ]
    },
    exhibition: {
      booths: "20"
    }
  }
};

/* Derived display values. Do not repeat these in the literal data above. */
(function (m) {
  var MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  var WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  var WEEKDAYS_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  function parse(iso) { return new Date(iso + "T00:00:00Z"); }
  function label(d) { return d.getUTCDate() + " " + MONTHS[d.getUTCMonth()] + " " + d.getUTCFullYear(); }
  function long(d) { return WEEKDAYS[d.getUTCDay()] + " " + label(d); }

  var start = parse(m.event.start);
  var end = parse(m.event.end);
  var pre = parse(m.event.start);
  pre.setUTCDate(pre.getUTCDate() - 1);

  m.event.year = String(start.getUTCFullYear());
  m.event.day1 = label(start);
  m.event.day2 = label(end);
  m.event.day1Long = long(start);
  m.event.day2Long = long(end);
  m.event.startISO = m.event.start + "T08:45:00+08:00";
  m.event.endISO = m.event.end + "T18:00:00+08:00";
  m.event.dateLabel = start.getUTCFullYear() === end.getUTCFullYear() && start.getUTCMonth() === end.getUTCMonth()
    ? start.getUTCDate() + "–" + end.getUTCDate() + " " + MONTHS[start.getUTCMonth()] + " " + start.getUTCFullYear()
    : label(start) + " – " + label(end);
  m.event.dateRangeShort = WEEKDAYS_SHORT[pre.getUTCDay()] + " " + pre.getUTCDate() + " – " +
    WEEKDAYS_SHORT[end.getUTCDay()] + " " + end.getUTCDate() + " " + MONTHS[end.getUTCMonth()] + " " + end.getUTCFullYear();

  m.venue.preConference.date = pre.toISOString().slice(0, 10);
  m.venue.preConference.label = label(pre);
  m.venue.preConference.long = long(pre);
  m.venue.short = m.venue.name + ", " + m.event.city;
  m.venue.bannerShort = "19&20/F, " + m.venue.name;
  m.event.bannerDateNote = "(Preconference: " + m.venue.preConference.label + ")";
  m.venue.address = m.venue.building + ", " + m.venue.street;

  m.ePosterFreePaper.opens = m.registration.opens;
  m.ePosterFreePaper.onsite = m.event.dateLabel;
  m.ePosterFreePaper.evaluation.date = m.event.start;
  m.ePosterFreePaper.freePaper.date = m.event.end;
  m.ePosterFreePaper.evaluation.label = label(start);
  m.ePosterFreePaper.evaluation.long = long(start);
  m.ePosterFreePaper.freePaper.label = label(end);
  m.ePosterFreePaper.freePaper.long = long(end);

  m.eProgramme.available = "Available " + m.eProgramme.date;
})(window.ASM_DATA_META.meta);
