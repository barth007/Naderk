/**
 * Fallback copy for /extend-life-africa, used for any section or field the CMS
 * has not filled in. Mirrors BackEnd/naderk/cms/extend_life_africa_content.py,
 * which seeds the CMS with the same text; keep the two in step.
 */

export const ELA_DEFAULTS = {
  hero: {
    badge: 'A charity for preventive health across Africa',
    title: 'Extend a life.',
    highlight: 'Start with one test.',
    description:
      'Chronic diseases like diabetes and hypertension often go undetected until it is too late. ' +
      'A single test, sponsored by you, can catch them early — and give someone the chance to take ' +
      'control of their health before disease takes control of them.',
    primaryCtaLabel: 'Sponsor a test',
    secondaryCtaLabel: 'Volunteer your time',
    highlights: [{ label: 'Point-of-care testing' }, { label: 'Telemedicine' }, { label: 'Health education' }],
  },
  giving: {
    cardTitle: 'Make a gift',
    prices: {
      NGN: { test: 9999, intervention: 20000 },
      GBP: { test: 5, intervention: 10 },
      USD: { test: 6.5, intervention: 13 },
    },
    amounts: {
      NGN: [9999, 20000, 50000, 100000, 150000, 250000],
      GBP: [5, 10, 25, 50, 100, 250],
      USD: [6.5, 13, 30, 60, 120, 300],
    },
  },
  waysToGive: {
    label: 'Get involved',
    title: 'Three ways to extend a life',
    description:
      'Every gift goes into early detection and prevention — before a chronic condition becomes a crisis.',
    testTitle: 'Sponsor a test',
    testDescription:
      'Fund one point-of-care screening that can catch diabetes, hypertension or heart disease early.',
    interventionTitle: 'Sponsor an intervention',
    interventionDescription:
      'Go beyond the result: fund the personalised follow-up care that helps someone manage, or even reverse, their condition.',
    generalTitle: 'Donate any amount',
    generalDescription:
      'Give once or every year. Your gift supports health promotion, diagnostics and telemedicine wherever it is needed most.',
  },
  whoWeAre: {
    label: 'Who we are',
    title: 'From treatment to prevention',
    quote:
      'Chronic diseases may not be inevitable, but with the right tools, guidance, and technology, they can be managed, prevented, or even reversed.',
    body:
      'Extend Life Africa (ELA) is a charitable organisation on a mission to transform healthcare across the continent by empowering individuals with information and the solutions to take control of their health and well-being. We promote early disease detection and behavioural changes to reverse chronic diseases.\n\n' +
      "Africa faces a growing burden of chronic diseases such as diabetes, hypertension and cardiovascular conditions, which often go undetected until it's too late. We believe the key to a healthier Africa lies in early detection, proactive care, and health education.\n\n" +
      'By leveraging state-of-the-art Point-of-Care testing, AI-powered health insights, telemedicine and health education — and the magnanimity of Lovers of Africa — we can help people live healthier, longer lives, and make quality preventive care available to all, regardless of socioeconomic status.',
    highlights: [
      { title: 'Early detection', description: 'Find it before it finds you.' },
      { title: 'Proactive care', description: 'Act on results, early.' },
      { title: 'Health education', description: 'Knowledge that changes habits.' },
    ],
  },
  whatWeDo: {
    label: 'What we do',
    title: 'Healthcare that acts before illness takes hold',
    description:
      'We champion primary care, eye care, early testing and preventive healthcare to prevent or manage non-communicable diseases.',
    pillars: [
      {
        title: 'Health promotion',
        description: 'Education and behaviour change that help individuals, families and communities take control of their health.',
      },
      {
        title: 'Diagnostics',
        description: 'Cutting-edge point-of-care testing that finds chronic disease early, close to where people live.',
      },
      {
        title: 'MedTech & telemedicine',
        description: 'Technology-driven, personalised interventions that bring clinicians to patients, wherever they are.',
      },
    ],
    conditionsLabel: 'Conditions we focus on',
    conditions: [
      { name: 'Diabetes' }, { name: 'Hypertension' }, { name: 'Cardiovascular disease' },
      { name: 'Eye health' }, { name: 'Other chronic conditions' },
    ],
    journeyTitle: 'Where your gift goes',
    journey: [
      { title: 'Screened early', description: 'A point-of-care test spots risk before symptoms appear.' },
      { title: 'Seen by a clinician', description: 'A virtual consultation explains the result and the options.' },
      { title: 'Supported to change', description: 'A personalised intervention helps manage or reverse the condition.' },
    ],
  },
  volunteer: {
    label: 'Volunteer',
    title: "Give one hour a week. Change someone's next ten years.",
    description:
      'Offer your expertise as a GP, nurse or nutritionist through short virtual consultations with patients — from wherever you are.',
    commitment: '1 hour / week',
    ctaLabel: 'Offer your time',
  },
  resources: {
    label: 'Resources',
    title: 'Learn to stay ahead of your health',
    linkLabel: 'All articles',
    linkHref: '/blog',
    items: [] as { title: string; summary: string; image: string; href: string }[],
  },
  trustees: {
    title: 'The trustees',
    members: [
      { name: 'Ellis Emwanta', role: 'Trustee', image: '' },
      { name: 'Helen Gbinigie', role: 'Trustee', image: '' },
      { name: 'Egbe Emwanta', role: 'Trustee', image: '' },
      { name: 'Joyce Nwatuobi', role: 'Trustee', image: '' },
    ],
  },
  contact: {
    title: 'Contact us',
    ngLabel: 'Nigeria (MTN)',
    ngPhone: '+234 000 000 0000',
    ukLabel: 'United Kingdom',
    ukPhone: '+44 0000 000000',
    email: 'info@example.org',
  },
  closing: {
    title: 'Not just more years — better ones.',
    description:
      'ELA is redefining healthcare by extending the quality of life lived, not just the years. Join us in helping people stay ahead of health challenges before they become life-threatening. Your future health starts now.',
    primaryCtaLabel: 'Donate now',
    secondaryCtaLabel: 'Volunteer',
  },
};

export const CURRENCIES = [
  { code: 'NGN', symbol: '₦', label: 'Naira' },
  { code: 'GBP', symbol: '£', label: 'Pounds' },
  { code: 'USD', symbol: '$', label: 'Dollars' },
] as const;

/** Mirrors AMOUNT_LIMITS in BackEnd/naderk/donations/services.py. */
export const AMOUNT_LIMITS = {
  NGN: { min: 100, max: 50_000_000 },
  GBP: { min: 1, max: 50_000 },
  USD: { min: 1, max: 50_000 },
} as const;
