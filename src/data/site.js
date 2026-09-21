export const SITE = {
  name: 'Vantik',
  owner: 'Sajid Hussain',
  role: 'Freelance Web Developer',
  whatsapp: '917358145522', // digits only, for wa.me links
  whatsappDisplay: '+91 73581 45522',
  email: 'sajid.hissain.freelancer@gmail.com',
  tagline: 'Websites built for your industry, not a template.',
  fallbackStats: {
    clients_count: 19,
    projects_count: 21,
  },
}

export const WHATSAPP_LINK = (message = "Hi Sajid, I'd like to talk about a website for my business.") =>
  `https://wa.me/${SITE.whatsapp}?text=${encodeURIComponent(message)}`

export const MAIL_LINK = (subject = 'Website enquiry — Vantik') =>
  `mailto:${SITE.email}?subject=${encodeURIComponent(subject)}`
