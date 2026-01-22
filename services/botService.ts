
const BOT_IDENTITIES = [
  { name: "Sajid Ahmed", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Rony Khan", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Tanvir Hossain", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Aryan Dev", country: "India", flag: "🇮🇳" },
  { name: "Rahul Das", country: "India", flag: "🇮🇳" },
  { name: "Sumaiya Akter", country: "India", flag: "🇮🇳" },
  { name: "Zubair Al-Mahmud", country: "Pakistan", flag: "🇵🇰" },
  { name: "Ishrat Jahan", country: "Pakistan", flag: "🇵🇰" },
  { name: "Alex Johnson", country: "USA", flag: "🇺🇸" },
  { name: "Lucas Silva", country: "Brazil", flag: "🇧🇷" },
  { name: "Budi Santoso", country: "Indonesia", flag: "🇮🇩" },
  { name: "Mehedi Hasan", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Nusrat Jahan", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Kabir Bin Anwar", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Priya Sharma", country: "India", flag: "🇮🇳" },
  { name: "David Miller", country: "USA", flag: "🇺🇸" }
];

export const getRandomBotIdentity = () => {
  return BOT_IDENTITIES[Math.floor(Math.random() * BOT_IDENTITIES.length)];
};
