import { sendRedirect } from 'h3'

export default defineEventHandler(async (event) => {
  return sendRedirect(event, '/beian-love-record.html', 302)
})
