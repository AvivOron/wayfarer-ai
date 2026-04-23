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
  transport: string
  groupType: string
  groupSize: number
  childAges: number[]
  interests: string[]
  foodPreferences?: string[]
  dietaryRestrictions?: string[]
  mustSee: { name: string; address: string; category: string }[]
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
- Only suggest places that are currently open
- Do NOT suggest outdoor parks or exposed activities if it is raining
- Prioritize indoor activities if there are young children (under 6) in the evening (after 5pm)
- Avoid places the user already visited today
- Prefer places within ${ctx.transport === 'walking' ? '15' : '30'} minutes travel time
- For restaurant/cafe/bar suggestions, strictly respect dietary restrictions${ctx.dietaryRestrictions?.length ? ` (${ctx.dietaryRestrictions.join(', ')})` : ''} — never suggest venues that cannot accommodate them

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

  return `You are a world-class trip planner for ${ctx.destination}.

Trip details:
- Dates: ${ctx.startDate} to ${ctx.endDate} (${nights} nights)
- Base hotel: ${ctx.hotelAddress}
- Transport: ${ctx.transport}
- Group: ${ctx.groupSize} ${ctx.groupType} ${kidsNote}
- Interests: ${ctx.interests.join(', ')}${foodNote}${dietNote}
- Must-see spots saved by user:
${ctx.mustSee.map((s, i) => `  ${i + 1}. ${s.name} (${s.category}) - ${s.address}`).join('\n')}

Create an optimized day-by-day itinerary. Rules:
- Cluster geographically nearby spots on the same day to minimize travel
- Account for typical opening hours (museums often close Mon, many restaurants close between 3-6pm)
- Insert meal breaks (breakfast ~8am, lunch ~12:30pm, dinner ~7pm)
- Start each day from the hotel, end near the hotel
- Consider child-friendliness if there are young children
- Keep a realistic pace — max 4-5 activities per day

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
          "emoji": "single emoji"
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

export async function generateSchedule(ctx: ScheduleContext): Promise<DaySchedule[]> {
  const model = getModel()
  const prompt = buildSchedulePrompt(ctx)
  const result = await model.generateContent(prompt)
  const text = result.response.text()
  const parsed = JSON.parse(text)
  return parsed.schedule as DaySchedule[]
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
