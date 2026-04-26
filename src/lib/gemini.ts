import { GoogleGenerativeAI, GenerationConfig } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

const jsonConfig: GenerationConfig = {
  responseMimeType: 'application/json',
  temperature: 0.7,
}

export function getModel() {
  return genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: jsonConfig,
  })
}

export interface NearbyContext {
  destination: string
  lat: number
  lng: number
  localTime: string
  weather?: string
  groupType: string
  groupSize: number
  childAges: number[]
  transport: string
  interests: string[]
  foodPreferences?: string[]
  dietaryRestrictions?: string[]
  visitedToday: string[]
}

export interface NearbyRecommendation {
  name: string
  type: string
  reason: string
  walkingMins: number
  isOpen: boolean
  tip: string
  emoji: string
}

export interface ScheduleContext {
  destination: string
  startDate: string
  endDate: string
  hotelAddress: string
  accommodationType?: string
  transport: string
  groupType: string
  groupSize: number
  childAges: number[]
  interests: string[]
  foodPreferences?: string[]
  dietaryRestrictions?: string[]
  mustSee: { name: string; address: string; category: string }[]
  notes?: string
}

export interface ScheduledActivity {
  day: number
  date: string
  time: string
  name: string
  address: string
  category: string
  durationMins: number
  travelMinsFromPrevious: number
  notes: string
  emoji: string
  groupLabel?: string
}

export interface DaySchedule {
  day: number
  date: string
  theme: string
  activities: ScheduledActivity[]
}

export function buildNearbyPrompt(ctx: NearbyContext): string {
  const kidsNote = ctx.childAges.length > 0
    ? `travelling with ${ctx.childAges.length} child(ren) aged ${ctx.childAges.join(', ')}`
    : 'no children'
  const weatherNote = ctx.weather ?? 'unknown weather'

  const foodNote = ctx.foodPreferences?.length ? `Food loves: ${ctx.foodPreferences.join(', ')}` : null
  const dietNote = ctx.dietaryRestrictions?.length ? `Dietary restrictions: ${ctx.dietaryRestrictions.join(', ')}` : null

  return `You are a world-class local travel expert for ${ctx.destination}.

User context:
- Current location: ${ctx.lat.toFixed(4)}°N, ${ctx.lng.toFixed(4)}°E
- Local time: ${ctx.localTime}
- Weather: ${weatherNote}
- Group: ${ctx.groupSize} ${ctx.groupType} (${kidsNote})
- Transport: ${ctx.transport}
- Interests: ${ctx.interests.join(', ')}${foodNote ? `\n- ${foodNote}` : ''}${dietNote ? `\n- ${dietNote}` : ''}
- Already visited today: ${ctx.visitedToday.length > 0 ? ctx.visitedToday.join(', ') : 'nothing yet'}

Rules:
- Only suggest real, permanently established, well-known places that you are highly confident exist and are operating in ${ctx.destination} — never fabricate or guess place names
- Only suggest places that are currently open based on the local time
- Do NOT suggest outdoor parks or exposed activities if it is raining
- Prioritize indoor activities if there are young children (under 6) in the evening (after 5pm)
- Avoid places the user already visited today
- Prefer places within ${ctx.transport === 'walking' ? '15' : '30'} minutes travel time
- For restaurant/cafe/bar suggestions, strictly respect dietary restrictions${ctx.dietaryRestrictions?.length ? ` (${ctx.dietaryRestrictions.join(', ')})` : ''} — never suggest venues that cannot accommodate them
- If you are not certain a place exists and is open, omit it and suggest a safer well-known alternative

Return a JSON object with exactly this structure:
{
  "recommendations": [
    {
      "name": "string",
      "type": "restaurant|attraction|cafe|museum|park|shop|bar",
      "reason": "1-2 sentence explanation why this is perfect right now",
      "walkingMins": number,
      "isOpen": true,
      "tip": "one insider tip (max 15 words)",
      "emoji": "single emoji"
    }
  ]
}

Return exactly 3 recommendations, ordered from best to third-best.`
}

export function buildSchedulePrompt(ctx: ScheduleContext): string {
  const nights = Math.round(
    (new Date(ctx.endDate).getTime() - new Date(ctx.startDate).getTime()) / 86400000
  )
  const kidsNote = ctx.childAges.length > 0
    ? `with ${ctx.childAges.length} child(ren) aged ${ctx.childAges.join(', ')}`
    : 'no children'

  const foodNote = ctx.foodPreferences?.length ? `\n- Food preferences: ${ctx.foodPreferences.join(', ')}` : ''
  const dietNote = ctx.dietaryRestrictions?.length ? `\n- Dietary restrictions: ${ctx.dietaryRestrictions.join(', ')} — strictly required for all meal suggestions` : ''
  const notesNote = ctx.notes?.trim() ? `\n\nIMPORTANT — fixed commitments from the traveller (must be scheduled exactly as specified):\n${ctx.notes.trim()}` : ''

  const accomType = ctx.accommodationType ?? 'hotel'
  const accomLabel: Record<string, string> = {
    hotel: 'hotel',
    apartment: 'private apartment',
    airbnb: 'Airbnb',
    hostel: 'hostel',
    friends: "friend's home",
  }
  const accomNote = accomType === 'friends'
    ? `\n- Accommodation note: traveller is staying at a friend's home — do NOT schedule "breakfast at accommodation" or hotel-specific activities; traveller makes their own breakfast arrangements`
    : accomType === 'apartment' || accomType === 'airbnb'
      ? `\n- Accommodation note: traveller is in a self-catered ${accomLabel[accomType]} — they may make their own breakfast, so only suggest breakfast out if it's a notable local experience`
      : ''

  return `You are a world-class trip planner for ${ctx.destination}.

Trip details:
- Dates: ${ctx.startDate} to ${ctx.endDate} (${nights} nights)
- Base ${accomLabel[accomType]}: ${ctx.hotelAddress}${accomNote}
- Transport: ${ctx.transport}
- Group: ${ctx.groupSize} ${ctx.groupType} ${kidsNote}
- Interests: ${ctx.interests.join(', ')}${foodNote}${dietNote}
- Spots the user wants to visit — schedule each exactly once, on the most suitable day:
${ctx.mustSee.map((s, i) => `  ${i + 1}. ${s.name} (${s.category}) - ${s.address}`).join('\n')}${notesNote}

Create an optimized day-by-day itinerary. Rules:
- CRITICAL: Every single spot listed above MUST appear in the schedule — do not skip any
- Cluster geographically nearby spots on the same day to minimize travel
- Account for typical opening hours (museums often close Mon, many restaurants close between 3-6pm)
- Insert meal breaks at appropriate times: breakfast ~8am, lunch ~12:30pm, dinner ~7pm. NEVER schedule lunch within 2 hours of breakfast or dinner within 2 hours of lunch — leave adequate gaps between meals
- If the notes mention a midway stop during a drive, place that stop at a location that is geographically between the origin and the destination (roughly halfway along the route), not near the destination itself
- Start each day from the base accommodation, end near it
- NEVER include activities like "return to hotel", "evening relaxation at accommodation", "check in", "unwind at hotel", or any activity whose purpose is simply going back to the accommodation — these are implied and add no value
- Consider child-friendliness if there are young children
- Keep a realistic pace — aim for 4-6 activities per day, more if the must-see list requires it
- Each activity must be ONE specific venue, place, or restaurant — NEVER bundle multiple places into one entry
- If consecutive activities share a theme or area (e.g. a neighbourhood stroll), give each its own entry and set the same "groupLabel" on all of them (e.g. groupLabel: "Marylebone Exploration"). The UI will render that as a header above the first entry in the group. Activities that are standalone should omit groupLabel entirely.

Return a JSON object with exactly this structure:
{
  "schedule": [
    {
      "day": 1,
      "date": "YYYY-MM-DD",
      "theme": "short day theme e.g. 'Historic Centre & Gastronomy'",
      "activities": [
        {
          "time": "HH:MM",
          "name": "string",
          "address": "string",
          "category": "restaurant|attraction|cafe|museum|park|transport|hotel",
          "durationMins": number,
          "travelMinsFromPrevious": number,
          "notes": "short insider note",
          "emoji": "single emoji",
          "groupLabel": "optional: shared label for consecutive activities in the same area/theme, omit if standalone"
        }
      ]
    }
  ]
}`
}

export async function generateNearbyRecommendations(
  ctx: NearbyContext
): Promise<NearbyRecommendation[]> {
  const model = getModel()
  const prompt = buildNearbyPrompt(ctx)
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const parsed = JSON.parse(text)
  return parsed.recommendations as NearbyRecommendation[]
}

function deduplicateSchedule(schedule: DaySchedule[]): DaySchedule[] {
  const seen = new Set<string>()
  return schedule.map(day => ({
    ...day,
    activities: day.activities.filter(a => {
      const key = a.name.toLowerCase().trim()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    }),
  }))
}

export async function generateSchedule(ctx: ScheduleContext): Promise<DaySchedule[]> {
  const model = getModel()
  const prompt = buildSchedulePrompt(ctx)
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const parsed = JSON.parse(text)
  return deduplicateSchedule(parsed.schedule as DaySchedule[])
}

export interface AreaPlace {
  name: string
  address: string
  category: string
  emoji: string
  reason: string
}

export type PlannerQueryIntent = 'area' | 'place'

export async function classifyPlannerQuery(
  query: string,
  destination: string
): Promise<PlannerQueryIntent> {
  const model = getModel()
  const prompt = `Classify this travel planner search query for ${destination}.

Query: "${query}"

Return "area" when the query is a neighborhood, district, borough, town, street, region, or broad area the user likely wants to explore or stroll through.
Return "place" when the query is a specific venue, attraction, restaurant, hotel, bar, shop, museum, landmark, or business/chain name where the user likely wants exact addresses.

Examples:
- "shoreditch" in London -> area
- "soho" in London -> area
- "Marylebone High Street" in London -> area
- "Brick Lane" in London -> area
- "dishoom" in London -> place
- "British Museum" in London -> place
- "Eiffel Tower" in Paris -> place

Return JSON only:
{ "intent": "area|place" }`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const parsed = JSON.parse(text) as { intent?: string }

  return parsed.intent === 'place' ? 'place' : 'area'
}

export function buildAreaExplorePrompt(area: string, destination: string, interests: string[]): string {
  return `You are a local expert for ${destination}.

The user wants to explore: "${area}"
Their interests: ${interests.length > 0 ? interests.join(', ') : 'general sightseeing'}

Suggest 8 specific, real places to visit in or around "${area}" in ${destination}.
Mix restaurants, cafes, attractions, shops, and hidden gems that fit the area's character.

Return a JSON object:
{
  "places": [
    {
      "name": "exact place name",
      "address": "street address or area description",
      "category": "restaurant|cafe|attraction|museum|park|shop|bar",
      "emoji": "single emoji",
      "reason": "one sentence why it's worth visiting"
    }
  ]
}`
}

export async function exploreArea(
  area: string,
  destination: string,
  interests: string[]
): Promise<AreaPlace[]> {
  const model = getModel()
  const prompt = buildAreaExplorePrompt(area, destination, interests)
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const parsed = JSON.parse(text)
  return parsed.places as AreaPlace[]
}

export async function generatePackingList(ctx: {
  destination: string
  startDate: string
  endDate: string
  groupType: string
  childAges: number[]
  interests: string[]
}): Promise<{ category: string; items: string[] }[]> {
  const model = getModel()
  const prompt = `You are a travel packing expert. Generate a practical packing list for:
- Destination: ${ctx.destination}
- Dates: ${ctx.startDate} to ${ctx.endDate}
- Group: ${ctx.groupType}${ctx.childAges.length > 0 ? ` with children aged ${ctx.childAges.join(', ')}` : ''}
- Activities: ${ctx.interests.join(', ')}

Return JSON:
{
  "categories": [
    { "category": "Clothing", "items": ["item1", "item2"] },
    { "category": "Documents", "items": [...] },
    { "category": "Toiletries", "items": [...] },
    { "category": "Electronics", "items": [...] },
    { "category": "Kids Essentials", "items": [...] }
  ]
}

Only include "Kids Essentials" if there are children. Be practical and concise.`

  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const parsed = JSON.parse(text)
  return parsed.categories
}

export interface PreTripItem {
  emoji: string
  task: string
  category: string
}

export async function generatePreTripChecklist(ctx: {
  destination: string
  startDate: string
  transport: string
  groupType: string
  childAges: number[]
}): Promise<PreTripItem[]> {
  const model = getModel()
  const prompt = `You are a travel preparation expert. Generate a practical pre-trip to-do checklist for someone travelling to ${ctx.destination} on ${ctx.startDate}.
Transport to destination: ${ctx.transport}. Group: ${ctx.groupType}${ctx.childAges.length > 0 ? ` with children aged ${ctx.childAges.join(', ')}` : ''}.

Include tasks like: booking transport to airport/station, getting travel insurance, buying an eSIM or local SIM, notifying bank, checking visa requirements, printing/downloading tickets, packing, arranging pet/home care, currency exchange, checking-in online, charging devices, downloading offline maps, etc. Tailor to the destination and group.

Return 12–18 items as JSON:
{
  "items": [
    { "emoji": "📱", "task": "Buy an eSIM for ${ctx.destination}", "category": "Connectivity" },
    { "emoji": "🛡️", "task": "Purchase travel insurance", "category": "Admin" }
  ]
}

Categories should be one of: Admin, Transport, Money, Health, Connectivity, Packing, Home.`

  const result = await model.generateContent(prompt)
  const parsed = JSON.parse(result.response.text())
  return parsed.items
}

export interface LocalTipItem {
  emoji: string
  tip: string
}

export interface LocalTipsSection {
  title: string
  items: LocalTipItem[]
}

export async function generateLocalTips(ctx: {
  destination: string
  groupType: string
  transport: string
}): Promise<LocalTipsSection[]> {
  const model = getModel()
  const prompt = `You are a local knowledge expert. Generate practical insider tips for a traveller visiting ${ctx.destination}.
Group type: ${ctx.groupType}. Main transport: ${ctx.transport}.

Cover these sections (use exactly these titles):
- Getting Around
- Money & Tipping
- Food & Drink
- Safety & Health
- Culture & Etiquette
- Useful Phrases

Each section should have 3–5 short, specific, actionable tips. Each tip has an emoji and a one-sentence tip.

Return JSON:
{
  "sections": [
    {
      "title": "Getting Around",
      "items": [
        { "emoji": "🚇", "tip": "Buy an Oyster card at any station — single fares are almost double the capped daily price." }
      ]
    }
  ]
}`

  const result = await model.generateContent(prompt)
  const parsed = JSON.parse(result.response.text())
  return parsed.sections
}
