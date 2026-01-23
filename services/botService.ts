
const BOT_IDENTITIES = [
  { name: "Alex Rivera", country: "USA", flag: "🇺🇸" },
  { name: "Sofia Silva", country: "Brazil", flag: "🇧🇷" },
  { name: "Hiroshi Sato", country: "Japan", flag: "🇯🇵" },
  { name: "Emma Wilson", country: "UK", flag: "🇬🇧" },
  { name: "Hans Müller", country: "Germany", flag: "🇩🇪" },
  { name: "Luca Rossi", country: "Italy", flag: "🇮🇹" },
  { name: "Mateo Garcia", country: "Spain", flag: "🇪🇸" },
  { name: "Chloe Dupont", country: "France", flag: "🇫🇷" },
  { name: "Kim Min-su", country: "South Korea", flag: "🇰🇷" },
  { name: "Zhang Wei", country: "China", flag: "🇨🇳" },
  { name: "Arjun Gupta", country: "India", flag: "🇮🇳" },
  { name: "Rony Khan", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Fatima Al-Sayed", country: "Egypt", flag: "🇪🇬" },
  { name: "Oliver Brown", country: "Australia", flag: "🇦🇺" },
  { name: "Elena Petrova", country: "Russia", flag: "🇷🇺" },
  { name: "Diego Messi", country: "Argentina", flag: "🇦🇷" },
  { name: "Isabella Jones", country: "Canada", flag: "🇨🇦" },
  { name: "Youssef Hassan", country: "Morocco", flag: "🇲🇦" }
];

export const getRandomBotIdentity = () => {
  return BOT_IDENTITIES[Math.floor(Math.random() * BOT_IDENTITIES.length)];
};
