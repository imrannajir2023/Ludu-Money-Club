
const REAL_NAMES = [
  "Sajid Ahmed", "Rony Khan", "Aryan Dev", "Sumaiya Akter", 
  "Tanvir Hossain", "Mehedi Hasan", "Nusrat Jahan", "Rahul Das",
  "Anika Tabassum", "Zubair Al-Mahmud", "Ishrat Jahan", "Kabir Bin Anwar"
];

export const getRandomBotName = () => {
  return REAL_NAMES[Math.floor(Math.random() * REAL_NAMES.length)];
};
