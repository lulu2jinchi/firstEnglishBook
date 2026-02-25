import { sendRedirect } from 'h3'

export default defineEventHandler(async (event) => {
  return sendRedirect(event, '/home', 302)
})
