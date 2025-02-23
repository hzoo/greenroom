// All available tone words
export const TONE_WORDS = [
	// Affect (emotional intensity)
	"neutral",
	"expressive",
	"reserved",
	"enthusiastic",
	"cold",
	"warm",

	// Formality
	"academic",
	"casual",
	"polite",
	"blunt",
	"rigid",
	"playful",

	// Authority
	"expert",
	"conversational",
	"commanding",
	"suggestive",
	"certain",
	"speculative",

	// Persuasion
	"logical",
	"emotional",
	"direct",
	"indirect",
	"didactic",
	"socratic",

	// Persona/archetype
	"sage",
	"jester",
	"mentor",
	"critic",
	"explorer",

	// Original tones
	"technical",
	"analytical",
	"empathetic",
	"supportive",
	"friendly",
];

export function getRandomTone(existingTones?: Set<string>): string {
	// If existingTones is provided, filter out tones that are already used
	const availableTones = existingTones
		? TONE_WORDS.filter((tone) => !existingTones.has(tone))
		: TONE_WORDS;

	// If all tones are used, return a random one from the full list
	if (availableTones.length === 0) {
		return TONE_WORDS[Math.floor(Math.random() * TONE_WORDS.length)];
	}

	// Return a random tone from the available ones
	return availableTones[Math.floor(Math.random() * availableTones.length)];
}
