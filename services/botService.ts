
const BOT_IDENTITIES = [
  { name: "Rony Khan", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Sajid Ahmed", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Hamim King", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Mehedi Hasan", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Tanvir Hossain", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Zubair Al-Mahmud", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Ayaan Rahman", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Nabil Islam", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Fahim Shahriar", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Sakib Al-Hasan", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Tamim Iqbal", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Mushfiqur", country: "Bangladesh", flag: "🇧🇩" },
  { name: "Aryan Dev", country: "India", flag: "🇮🇳" },
  { name: "Rahul Das", country: "India", flag: "🇮🇳" }
];

export const getRandomBotIdentity = () => {
  return BOT_IDENTITIES[Math.floor(Math.random() * BOT_IDENTITIES.length)];
};
