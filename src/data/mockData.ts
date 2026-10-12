import { AppData, Service } from '../types';

function upcomingSundays(n: number): Service[] {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
  const out: Service[] = [];
  for (let i = 0; i < n; i++) {
    const iso = d.toISOString().slice(0, 10);
    out.push({ id: `sun-${iso}`, date: iso, title: 'Sunday Service', time: '10:30' });
    if (i === 1) {
      const fri = new Date(d); fri.setDate(fri.getDate() + 5);
      out.push({ id: `evt-youth`, date: fri.toISOString().slice(0, 10), title: 'Youth Night', time: '19:00' });
    }
    d.setDate(d.getDate() + 7);
  }
  return out;
}

const SERVICES = upcomingSundays(4);

export const mockData: AppData = {
  // Passwords are stored only as salted SHA-256 hashes. Temp passwords were shared privately.
  users: [
    { id: "u-vini", username: "Vini", name: "Marcos Alves", role: "owner", departmentIds: [], salt: "5f58e27c8ad66fe802f38f1f04b0ee5e", passwordHash: "435e21a06426dc1c013365bda4bce81876154b54cdd61e90266d0bce41be7537", mustChangePassword: true, active: true },
    { id: "u-lucas", username: "Lucas", name: "Lucas", role: "admin", departmentIds: [], salt: "1d269175121ef36af3246f4b2ddd7932", passwordHash: "ac816454296ea2605edebabb777268f446a1a2a71519268f0399b3025e4b2304", mustChangePassword: true, active: true },
    { id: "u-camila", username: "Camila", name: "Camila", role: "admin", departmentIds: [], salt: "290099e5bab11fa3cbf1d2caa7c2438d", passwordHash: "425dd074abd7200a983759da4caf760f1b39f7631e700f91cc2d824019a004bf", mustChangePassword: true, active: true },
    { id: "u-miguel", username: "Miguel", name: "Miguel", role: "volunteer", departmentIds: [], salt: "c5ffc6a18d929438b9dfe675adb6bebb", passwordHash: "4f02aa4823aba1e7444396c5a0e5f2dbe078b9cc15726d44bc1c88dcc2514c65", mustChangePassword: true, active: true },
    { id: "u-antony", username: "Antony", name: "Antony", role: "volunteer", departmentIds: [], salt: "9053e0a566bfb72e6dadee07ec6dadcc", passwordHash: "fad40afd79c2f772e04204da0069f3f88d12e196bc19bf58a5a2d25b1a6fb9a8", mustChangePassword: true, active: true },
    { id: "u-tiago", username: "Tiago", name: "Tiago", role: "volunteer", departmentIds: [], salt: "4d5be6fc27d94dfee3c2463160f94326", passwordHash: "8444036a25be520d9eb670ddd7adde4b87940575682ccf472e0d1d4e0e97fd56", mustChangePassword: true, active: true },
    { id: "u-rodrigo", username: "Rodrigo", name: "Rodrigo", role: "volunteer", departmentIds: [], salt: "b91ce6f3200b6a5f69a3b738d4ce9b3f", passwordHash: "94a2fd19140a7c72748502cd66af62bdec8c6c2389e5a2c3430e36c684a1f03d", mustChangePassword: true, active: true },
    { id: "u-juliana", username: "Juliana", name: "Juliana", role: "volunteer", departmentIds: [], salt: "c8beeca2c8da6b0d842c4e968b9082d7", passwordHash: "45dae8549a2e9541e16227bbe8bc4729923c13aa74fdfd8ab25b2636ceb0632f", mustChangePassword: true, active: true },
    { id: "u-juliano", username: "Juliano", name: "Juliano", role: "volunteer", departmentIds: [], salt: "60007d640967ba8807488b8cfcaee27f", passwordHash: "d1907b2cb9987efd886e193df81e54d637e9a8c1246e843ae8b0fd60a7a50e3f", mustChangePassword: true, active: true },
    { id: "u-larissa", username: "Larissa", name: "Larissa", role: "volunteer", departmentIds: [], salt: "faef90f8fd7d077e39459f317f94782b", passwordHash: "a23d06547a3b816e3d1cf9290017e467a86892e5044ad06564d0db8f9480c048", mustChangePassword: true, active: true },
    { id: "u-francieli", username: "Francieli", name: "Francieli", role: "volunteer", departmentIds: [], salt: "121c320a17db09bfecadfb02975beaa6", passwordHash: "2eb8484385966086bce81538018897d64352c656f4f7cf4eda76472a49ca7ea1", mustChangePassword: true, active: true },
    { id: "u-anaclara", username: "AnaClara", name: "Ana Clara", role: "volunteer", departmentIds: [], salt: "6b9d890f57f387e292f59b15effdd5c4", passwordHash: "f1267078cdbe7b1b0d41ecd853df9f2b2f6d3e88f72bec3ce15c78d0998a8bfc", mustChangePassword: true, active: true },
    { id: "u-davi", username: "Davi", name: "Davi", role: "volunteer", departmentIds: [], salt: "0f9c078db5b85f282278645f9b4c8178", passwordHash: "5be74e0c980a5eff5991595ba0abddb90de8bac01cb5fa5c5eb7b060405fb89b", mustChangePassword: true, active: true },
    { id: "u-francisco", username: "Francisco", name: "Francisco", role: "volunteer", departmentIds: [], salt: "32195185a9e6ee52788d6dc68fadc8dd", passwordHash: "d52e943d7305494de2c0ea216e41cb4496cae6ca2373256fc452aef377fcf6bb", mustChangePassword: true, active: true },
    { id: "u-andrea", username: "Andrea", name: "Andrea", role: "volunteer", departmentIds: [], salt: "00ba9878a316f6a109637e0064159dd4", passwordHash: "cd7117ebc5d4e40f14ed796011dc273584709b53669db744855591678b5ea661", mustChangePassword: true, active: true },
    { id: "u-danielly", username: "Danielly", name: "Danielly", role: "volunteer", departmentIds: [], salt: "b2c5b35c3c00e98a58504869c96323f0", passwordHash: "7f756d2c5e41f10d804b6fb930f8a80663b34f96158b0aefde424f352fc8461a", mustChangePassword: true, active: true },
    { id: "u-leidiane", username: "Leidiane", name: "Leidiane", role: "volunteer", departmentIds: [], salt: "e7e19c4629cc3e870658dd9c481770e9", passwordHash: "6d6426ee750c0a6bb487729ceb3dfde0399131176cc776720cdedf9a25f11c46", mustChangePassword: true, active: true },
    { id: "u-vitoria", username: "Vitoria", name: "Vitória", role: "volunteer", departmentIds: [], salt: "16bcaa4374036cc80253c51992ffcf1a", passwordHash: "87fc68e7ff9ce42277a4311f5d7358e5823b9006b6c76b9a016e3b6cb429f240", mustChangePassword: true, active: true },
    { id: "u-elisa", username: "Elisa", name: "Elisa", role: "volunteer", departmentIds: [], salt: "330570825300941020810cc5f7cde491", passwordHash: "d4ae847c8e9c3c1ee1f93c129ccba2ae08d5a8c5471dbb005ae238ef66ec12cc", mustChangePassword: true, active: true },
  ],
  departments: [
    { id: 'd-music', name: 'Music', emoji: '🎵', color: '#7C3AED', leaderId: null, positions: ['Lead Vocal', 'Backing Vocal', 'Keys'] },
    { id: 'd-kids', name: 'Kids', emoji: '🧸', color: '#10B981', leaderId: null, positions: ['Teacher', 'Helper'] },
    { id: 'd-obreiros', name: 'Obreiros', emoji: '🤝', color: '#F59E0B', leaderId: null, positions: ['Front Door', 'Altar', 'Offering'] },
  ],
  services: SERVICES,
  availability: [],
  assignments: [],
};
