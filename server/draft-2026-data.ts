export interface CombineData {
  fortyYard: number | null;
  benchPress: number | null;
  vertical: number | null;
  broadJump: number | null;
  threeCone: number | null;
  shuttle: number | null;
  armLength: number | null;
  handSize: number | null;
}

export interface DraftScoutingReport {
  strengths: string[];
  weaknesses: string[];
  nflComparison: string;
  draftProjection: string;
  fantasyOutlook: string;
}

export interface Draft2026Player {
  id: string;
  rank: number;
  name: string;
  college: string;
  position: string;
  height: string;
  weight: number;
  side: 'offense' | 'defense';
  positionGroup: string;
  stockStatus: 'rising' | 'falling' | 'steady';
  stockChange: number;
  combine: CombineData | null;
  intangibles: string[];
  scoutingNotes: string | null;
  scouting: DraftScoutingReport | null;
}

const OFFENSE_POSITIONS = new Set(['QB', 'RB', 'WR', 'WRS', 'TE', 'FB']);

function getSide(position: string): 'offense' | 'defense' {
  return OFFENSE_POSITIONS.has(position) ? 'offense' : 'defense';
}

function getPositionGroup(position: string): string {
  switch (position) {
    case 'QB': return 'QB';
    case 'RB': return 'RB';
    case 'FB': return 'RB';
    case 'WR': return 'WR';
    case 'WRS': return 'WR';
    case 'TE': return 'TE';
    case 'EDGE': return 'EDGE';
    case 'DL1T': return 'DL';
    case 'DL3T': return 'DL';
    case 'DL5T': return 'DL';
    case 'ILB': return 'LB';
    case 'LB': return 'LB';
    case 'CB': return 'CB';
    case 'S': return 'S';
    default: return position;
  }
}

function p(
  rank: number, name: string, college: string, position: string,
  height: string, weight: number,
  stockStatus: 'rising' | 'falling' | 'steady' = 'steady',
  stockChange: number = 0,
  intangibles: string[] = [],
  scoutingNotes: string | null = null
): Draft2026Player {
  return {
    id: `draft2026-${rank}`,
    rank,
    name,
    college,
    position,
    height,
    weight,
    side: getSide(position),
    positionGroup: getPositionGroup(position),
    stockStatus,
    stockChange,
    combine: null,
    intangibles,
    scoutingNotes,
    scouting: null,
  };
}

export const DRAFT_2026_PLAYERS: Draft2026Player[] = [
  p(1, "Fernando Mendoza", "Indiana", "QB", "6'5\"", 225, 'rising', 12, ["Arm Talent", "Pocket Presence"], "Elite arm strength with improving accuracy"),
  p(2, "Caleb Downs", "Ohio State", "S", "6'0\"", 205, 'rising', 8, ["Playmaker", "Football IQ", "Versatility"], "Rare safety talent with ball skills"),
  p(3, "Rueben Bain Jr.", "Miami (FL)", "EDGE", "6'3\"", 275, 'steady', 0, ["Motor", "Bend", "Competitive Toughness"], "Relentless pass rusher with elite bend"),
  p(7, "Jeremiyah Love", "Notre Dame", "RB", "6'0\"", 210, 'rising', 15, ["Explosiveness", "Vision"], "Dynamic playmaker with breakaway speed"),
  p(8, "Jermod McCoy", "Tennessee", "CB", "5'11\"", 193),
  p(9, "Carnell Tate", "Ohio State", "WR", "6'1\"", 191, 'rising', 10, ["Route Running", "Hands"], "Smooth route runner with reliable hands"),
  p(10, "Makai Lemon", "USC", "WR", "5'11\"", 190, 'steady', 0, ["Competitiveness", "YAC Ability"], "Physical receiver who wins after the catch"),
  p(11, "Keldric Faulk", "Auburn", "DL5T", "6'5\"", 288, 'steady', 0, ["Power", "Anchor"], "Dominant run defender with pass rush upside"),
  p(12, "David Bailey", "Texas Tech", "EDGE", "6'3\"", 250),
  p(13, "Mansoor Delane", "LSU", "CB", "6'1\"", 187),
  p(14, "Jordyn Tyson", "Arizona State", "WR", "6'1\"", 195, 'steady', 0, ["Speed", "Route Running"], "Smooth separator with deep speed"),
  p(15, "Peter Woods", "Clemson", "DL3T", "6'3\"", 315, 'steady', 0, ["Strength", "Disruption"], "Interior monster who collapses the pocket"),
  p(17, "Cashius Howell", "Texas A&M", "EDGE", "6'4\"", 245),
  p(18, "Denzel Boston", "Washington", "WR", "6'3\"", 209, 'rising', 7, ["Size-Speed", "Contested Catches"], "Dominant contested catch winner"),
  p(19, "T.J. Parker", "Clemson", "EDGE", "6'3\"", 265, 'steady', 0, ["Length", "Motor"], "High-floor pass rusher with technique"),
  p(23, "Lee Hunter", "Texas Tech", "DL1T", "6'4\"", 320),
  p(24, "Colton Hood", "Tennessee", "CB", "5'11\"", 195),
  p(26, "Caleb Banks", "Florida", "DL1T", "6'6\"", 325),
  p(27, "Kenyon Sadiq", "Oregon", "TE", "6'3\"", 235, 'steady', 0, ["Athleticism", "Red Zone Threat"], "Matchup nightmare at tight end"),
  p(28, "Ty Simpson", "Alabama", "QB", "6'2\"", 208, 'steady', 0, ["Mobility", "Arm Talent"], "Dual-threat upside with improving pocket skills"),
  p(29, "Christen Miller", "Georgia", "DL3T", "6'4\"", 305),
  p(31, "Akheem Mesidor", "Miami (FL)", "DL5T", "6'2\"", 280),
  p(32, "Kevin Concepcion", "Texas A&M", "WR", "5'11\"", 187),
  p(33, "Emmanuel McNeil-Warren", "Toledo", "S", "6'2\"", 202),
  p(34, "Chris Bell", "Louisville", "WR", "6'2\"", 220),
  p(35, "Anthony Hill Jr.", "Texas", "ILB", "6'3\"", 235, 'steady', 0, ["Instincts", "Tackling", "Leadership"], "Leader of the defense, sideline-to-sideline"),
  p(36, "Brandon Cisse", "South Carolina", "CB", "6'0\"", 190),
  p(37, "Kayden McDonald", "Ohio State", "DL1T", "6'2\"", 326),
  p(38, "Dillon Thieneman", "Oregon", "S", "6'0\"", 207, 'rising', 18, ["Range", "Tackling", "Instincts"], "Do-it-all safety rising fast"),
  p(39, "L.T. Overton", "Alabama", "DL5T", "6'4\"", 283),
  p(40, "Romello Height", "Texas Tech", "EDGE", "6'3\"", 240),
  p(42, "Gabe Jacas", "Illinois", "EDGE", "6'2\"", 275),
  p(43, "Zachariah Branch", "Georgia", "WR", "5'10\"", 175, 'rising', 6, ["Speed", "Elusiveness"], "Electric playmaker in open space"),
  p(44, "Eli Stowers", "Vanderbilt", "TE", "6'4\"", 235),
  p(47, "Joshua Josephs", "Tennessee", "EDGE", "6'3\"", 245),
  p(48, "Kamari Ramsey", "USC", "S", "6'0\"", 204),
  p(50, "Deontae Lawson", "Alabama", "ILB", "6'2\"", 239, 'steady', 0, ["Football IQ", "Communication"], "QB of the defense, elite play recognition"),
  p(51, "R Mason Thomas", "Oklahoma", "EDGE", "6'2\"", 243),
  p(53, "Dani Dennis-Sutton", "Penn State", "EDGE", "6'4\"", 266),
  p(54, "Ja'Kobi Lane", "USC", "WR", "6'4\"", 195),
  p(56, "Davison Igbinosun", "Ohio State", "CB", "6'2\"", 193, 'rising', 14, ["Length", "Ball Skills"], "Long corner with elite ball skills"),
  p(57, "Keith Abney II", "Arizona State", "CB", "5'10\"", 195),
  p(58, "Zion Young", "Missouri", "EDGE", "6'5\"", 265),
  p(59, "Domonique Orange", "Iowa State", "DL1T", "6'3\"", 325),
  p(60, "Malik Muhammad", "Texas", "CB", "6'0\"", 190),
  p(61, "Elijah Sarratt", "Indiana", "WR", "6'2\"", 209),
  p(63, "Derrick Moore", "Michigan", "EDGE", "6'3\"", 256),
  p(64, "Chris Brazzell II", "Tennessee", "WR", "6'5\"", 200),
  p(65, "Domani Jackson", "Alabama", "CB", "6'1\"", 201),
  p(67, "Germie Bernard", "Alabama", "WR", "6'0\"", 209),
  p(68, "Carson Beck", "Miami (FL)", "QB", "6'4\"", 220, 'falling', -15, ["Arm Talent"], "Injury concerns after ACL tear"),
  p(69, "Chris Johnson", "San Diego State", "CB", "6'0\"", 195),
  p(71, "Malachi Fields", "Notre Dame", "WR", "6'4\"", 220),
  p(72, "Jacob Rodriguez", "Texas Tech", "ILB", "6'1\"", 230),
  p(74, "Jadarian Price", "Notre Dame", "RB", "5'11\"", 210),
  p(76, "Daylen Everette", "Georgia", "CB", "6'1\"", 190),
  p(77, "Garrett Nussmeier", "LSU", "QB", "6'2\"", 200, 'falling', -8, ["Competitiveness"], "Turnover-prone tendencies"),
  p(78, "Michael Taaffe", "Texas", "S", "6'0\"", 195),
  p(79, "Bud Clark", "TCU", "S", "6'2\"", 185),
  p(80, "Jonah Coleman", "Washington", "RB", "5'9\"", 229),
  p(81, "Max Klare", "Ohio State", "TE", "6'4\"", 240),
  p(82, "Julian Neal", "Arkansas", "CB", "6'2\"", 208),
  p(85, "Antonio Williams", "Clemson", "WR", "5'11\"", 190),
  p(86, "Keionte Scott", "Miami (FL)", "S", "5'11\"", 192),
  p(89, "Kevin Coleman Jr.", "Missouri", "WR", "5'11\"", 180),
  p(90, "Josiah Trotter", "Missouri", "ILB", "6'2\"", 237),
  p(91, "A.J. Haulcy", "LSU", "S", "5'11\"", 222),
  p(92, "Anthony Lucas", "USC", "DL5T", "6'4\"", 285),
  p(93, "Michael Trigg", "Baylor", "TE", "6'4\"", 246),
  p(94, "Tyreak Sapp", "Florida", "DL5T", "6'3\"", 275),
  p(95, "Deion Burks", "Oklahoma", "WRS", "5'9\"", 194),
  p(97, "Zane Durant", "Penn State", "DL3T", "6'1\"", 288),
  p(98, "Kaytron Allen", "Penn State", "RB", "5'10\"", 220),
  p(99, "Darrell Jackson Jr.", "Florida State", "DL1T", "6'5\"", 330),
  p(100, "Dontay Corleone", "Cincinnati", "DL1T", "6'1\"", 320),
  p(101, "Mikail Kamara", "Indiana", "EDGE", "6'0\"", 265),
  p(102, "Taurean York", "Texas A&M", "ILB", "5'11\"", 235),
  p(103, "Ted Hurst", "Georgia State", "WR", "6'2\"", 194),
  p(104, "Tacario Davis", "Washington", "CB", "6'3\"", 190),
  p(105, "Drew Allar", "Penn State", "QB", "6'5\"", 235, 'falling', -10, ["Arm Strength"], "Inconsistent decision-making in 2025"),
  p(106, "Jack Endries", "Texas", "TE", "6'4\"", 240),
  p(107, "Gracen Halton", "Oklahoma", "DL3T", "6'2\"", 285),
  p(109, "Devin Moore", "Florida", "CB", "6'3\"", 198),
  p(110, "Zxavian Harris", "Ole Miss", "DL1T", "6'6\"", 320),
  p(111, "Trinidad Chambliss", "Ole Miss", "QB", "6'0\"", 200),
  p(113, "Rayshaun Benny", "Michigan", "DL3T", "6'3\"", 296),
  p(114, "Lander Barton", "Utah", "ILB", "6'3\"", 236),
  p(115, "Omar Cooper Jr.", "Indiana", "WR", "6'0\"", 204),
  p(116, "Tim Keenan III", "Alabama", "DL1T", "6'2\"", 326),
  p(117, "Max Llewellyn", "Iowa", "EDGE", "6'4\"", 263),
  p(118, "Cade Klubnik", "Clemson", "QB", "6'2\"", 210, 'rising', 20, ["Poise", "Leadership", "Mobility"], "Stock skyrocketing after breakout 2025"),
  p(119, "Nick Singleton", "Penn State", "RB", "6'0\"", 226, 'falling', -7, ["Power"], "Limited receiving role hurts dynasty value"),
  p(120, "Demond Claiborne", "Wake Forest", "RB", "5'9\"", 195),
  p(122, "T.J.Hall", "Iowa", "CB", "6'0\"", 190),
  p(125, "Aaron Anderson", "LSU", "WRS", "5'8\"", 187),
  p(127, "Jalen Huskey", "Maryland", "S", "6'2\"", 201),
  p(128, "Malachi Lawrence", "UCF", "EDGE", "6'4\"", 260),
  p(129, "Bishop Fitzgerald", "USC", "S", "5'11\"", 198),
  p(130, "Oscar Delp", "Georgia", "TE", "6'5\"", 245),
  p(132, "Eric Rivers", "Georgia Tech", "WRS", "5'11\"", 174),
  p(133, "Emmett Johnson", "Nebraska", "RB", "5'11\"", 200),
  p(135, "Skyler Bell", "Connecticut", "WR", "6'0\"", 185),
  p(136, "Mike Washington Jr.", "Arkansas", "RB", "6'2\"", 228),
  p(137, "Dae'Quan Wright", "Ole Miss", "TE", "6'4\"", 255),
  p(138, "Jaishawn Barham", "Michigan", "EDGE", "6'3\"", 248),
  p(139, "Albert Regis", "Texas A&M", "DL3T", "6'1\"", 310),
  p(140, "J'Mari Taylor", "Virginia", "RB", "5'9\"", 204),
  p(142, "DeMonte Capehart", "Clemson", "DL1T", "6'4\"", 315),
  p(143, "C.J. Daniels", "Miami (FL)", "WR", "6'2\"", 205),
  p(144, "Aaron Graves", "Iowa", "DL3T", "6'4\"", 300),
  p(145, "Jimmy Rolder", "Michigan", "ILB", "6'2\"", 240),
  p(146, "DeShon Singleton", "Nebraska", "S", "6'3\"", 210),
  p(147, "Will Lee III", "Texas A&M", "CB", "6'2\"", 190),
  p(148, "Sawyer Robertson", "Baylor", "QB", "6'4\"", 220),
  p(150, "Le'Veon Moss", "Texas A&M", "RB", "5'11\"", 215),
  p(151, "Caden Curry", "Ohio State", "EDGE", "6'3\"", 260),
  p(152, "Ephesians Prysock", "Washington", "CB", "6'4\"", 195),
  p(153, "Bryce Boettcher", "Oregon", "ILB", "6'2\"", 225),
  p(154, "Taylen Green", "Arkansas", "QB", "6'6\"", 230, 'falling', -12, ["Athleticism"], "Raw passer struggling with accuracy"),
  p(155, "Louis Moore", "Indiana", "S", "5'11\"", 200),
  p(156, "Thaddeus Dixon", "North Carolina", "CB", "6'0\"", 186),
  p(157, "Seth McGowan", "Kentucky", "RB", "6'1\"", 215),
  p(159, "Aiden Fisher", "Indiana", "ILB", "6'1\"", 233),
  p(162, "Chase Roberts", "BYU", "WR", "6'4\"", 210),
  p(163, "Nadame Tucker", "Western Michigan", "EDGE", "6'3\"", 250),
  p(164, "Josh Cuevas", "Alabama", "TE", "6'3\"", 256),
  p(165, "Roman Hemby", "Indiana", "RB", "6'0\"", 208),
  p(166, "Josh Moten", "Southern Miss", "CB", "6'0\"", 174),
  p(168, "Justin Joly", "NC State", "TE", "6'3\"", 251),
  p(169, "Stephen Daley", "Indiana", "EDGE", "6'1\"", 273),
  p(170, "Riley Nowakowski", "Indiana", "TE", "6'2\"", 249),
  p(171, "Hezekiah Masses", "California", "CB", "6'0\"", 175),
  p(172, "Isaiah Smith", "SMU", "EDGE", "6'4\"", 248),
  p(174, "Keanu Tanuvasa", "BYU", "DL3T", "6'3\"", 300),
  p(175, "Josh Cameron", "Baylor", "WR", "6'1\"", 218),
  p(176, "Joe Royer", "Cincinnati", "TE", "6'4\"", 255),
  p(177, "Patrick Payton", "LSU", "EDGE", "6'5\"", 250),
  p(179, "V.J. Payne", "Kansas State", "S", "6'3\"", 208),
  p(180, "Trey Moore", "Texas", "EDGE", "6'3\"", 245),
  p(182, "Terion Stewart", "Virginia Tech", "RB", "5'9\"", 222),
  p(183, "Keyron Crawford", "Auburn", "EDGE", "6'4\"", 255),
  p(185, "Colbie Young", "Georgia", "WR", "6'3\"", 215),
  p(186, "Justin Jefferson", "Alabama", "ILB", "6'1\"", 225),
  p(187, "Ethan Burke", "Texas", "DL5T", "6'6\"", 259),
  p(188, "Owen Heinecke", "Oklahoma", "ILB", "6'1\"", 227),
  p(189, "Kaleb Proctor", "SE Louisiana", "DL5T", "6'3\"", 280),
  p(191, "Deven Eastern", "Minnesota", "DL1T", "6'6\"", 320),
  p(192, "T.J. Guy", "Michigan", "EDGE", "6'4\"", 250),
  p(194, "Noah Whittington", "Oregon", "RB", "5'8\"", 203),
  p(195, "Wesley Williams", "Duke", "EDGE", "6'3\"", 264),
  p(196, "Bryson Eason", "Tennessee", "DL3T", "6'3\"", 315),
  p(197, "Zakee Wheatley", "Penn State", "S", "6'2\"", 198),
  p(198, "Tanner Koziol", "Houston", "TE", "6'6\"", 237),
  p(199, "Bryan Thomas Jr.", "South Carolina", "EDGE", "6'2\"", 249),
  p(200, "Brent Austin", "Cal", "CB", "5'11\"", 180),
  p(201, "Jakobe Thomas", "Miami (FL)", "S", "6'2\"", 200),
  p(202, "Cam'Ron Stewart", "Temple", "EDGE", "6'4\"", 250),
  p(203, "Chris McClellan", "Missouri", "DL1T", "6'4\"", 323),
  p(204, "Skyler Gill-Howard", "Texas Tech", "DL5T", "6'1\"", 290),
  p(205, "Harrison Wallace III", "Ole Miss", "WR", "6'1\"", 200),
  p(206, "Cameron Ball", "Arkansas", "DL1T", "6'5\"", 323),
  p(208, "Diego Pavia", "Vanderbilt", "QB", "6'0\"", 207),
  p(209, "Barion Brown", "LSU", "WR", "6'1\"", 182),
  p(211, "Reggie Virgil", "Texas Tech", "WR", "6'3\"", 190),
  p(212, "Keyshaun Elliott", "Arizona State", "ILB", "6'2\"", 235),
  p(213, "Cole Payton", "North Dakota State", "QB", "6'3\"", 233),
  p(214, "Hank Beatty", "Illinois", "WRS", "5'10\"", 185),
  p(216, "West Weeks", "LSU", "ILB", "6'2\"", 235),
  p(219, "Genesis Smith", "Arizona State", "S", "6'2\"", 204),
  p(220, "Charles Demmings", "Stephen F Austin", "CB", "6'1\"", 190),
  p(221, "Jalon Kilgore", "South Carolina", "S", "6'1\"", 219),
  p(222, "Kendal Daniels", "Oklahoma", "S", "6'5\"", 242),
  p(223, "Logan Fano", "Utah", "EDGE", "6'5\"", 260),
  p(224, "Red Murdock", "Buffalo", "ILB", "6'3\"", 235),
  p(227, "Caullin Lacy", "Louisville", "WRS", "5'10\"", 190),
  p(228, "Brandon Cleveland", "NC State", "DL1T", "6'4\"", 315),
  p(229, "Bryce Lance", "North Dakota State", "WR", "6'2\"", 204),
  p(231, "Jam Miller", "Alabama", "RB", "5'10\"", 221),
  p(235, "Dallen Bentley", "Utah", "TE", "6'4\"", 259),
  p(237, "Gary Smith III", "UCLA", "DL1T", "6'2\"", 340),
  p(238, "Rahsul Faison", "South Carolina", "RB", "6'0\"", 218),
  p(239, "Desmond Purnell", "Kansas State", "ILB", "5'11\"", 232),
  p(241, "Ahmari Harvey", "Georgia Tech", "CB", "6'0\"", 195),
  p(242, "Sam Roush", "Stanford", "TE", "6'5\"", 260),
  p(243, "Chip Trayanum", "Toledo", "RB", "5'11\"", 227),
  p(245, "Tyler Onyedim", "Texas A&M", "DL5T", "6'3\"", 295),
  p(246, "Dan Villari", "Syracuse", "TE", "6'4\"", 245),
  p(247, "Xavier Nwankpa", "Iowa", "S", "6'2\"", 215),
  p(249, "Nate Boerkircher", "Texas A&M", "TE", "6'4\"", 250),
  p(250, "Ty Montgomery", "John Carroll", "WR", "6'1\"", 185),
  p(254, "O'Mega Blake", "Arkansas", "WR", "6'1\"", 187),
  p(255, "Mohamed Toure", "Miami (FL)", "ILB", "6'1\"", 236),
  p(256, "Jalon Daniels", "Kansas", "QB", "6'0\"", 220),
  p(257, "George Gumbs", "Florida", "EDGE", "6'4\"", 250),
  p(258, "Mason Reiger", "Wisconsin", "EDGE", "6'5\"", 248),
  p(260, "Kaden Wetjen", "Iowa", "WRS", "5'9\"", 196),
  p(261, "Caleb Douglas", "Texas Tech", "WR", "6'4\"", 205),
  p(263, "Adam Randall", "Clemson", "RB", "6'2\"", 235),
  p(265, "James Thompson Jr.", "Illinois", "DL3T", "6'5\"", 310),
  p(266, "Kody Huisman", "Virginia Tech", "DL1T", "6'3\"", 297),
  p(267, "Miller Moss", "Louisville", "QB", "6'2\"", 205),
  p(270, "Shad Banks Jr.", "UTSA", "ILB", "6'0\"", 230),
  p(271, "Jack Pyburn", "LSU", "EDGE", "6'4\"", 264),
  p(272, "D.Q. Smith", "South Carolina", "S", "6'1\"", 219),
  p(274, "Eli Raridon", "Notre Dame", "TE", "6'7\"", 252),
  p(275, "Keelan Marion", "Miami (FL)", "WR", "6'0\"", 195),
  p(277, "Wesley Bailey", "Louisville", "EDGE", "6'5\"", 265),
  p(278, "Jalen Walthall", "Incarnate Word", "WR", "6'2\"", 180),
  p(279, "Bauer Sharp", "LSU", "TE", "6'5\"", 246),
  p(281, "Joey Aguilar", "Tennessee", "QB", "6'3\"", 225),
  p(282, "Cian Slone", "NC State", "EDGE", "6'4\"", 252),
  p(283, "Cyrus Allen", "Cincinnati", "WR", "5'11\"", 180),
  p(284, "Nick Barrett", "South Carolina", "DL1T", "6'2\"", 322),
  p(285, "Kaelon Black", "Indiana", "RB", "5'10\"", 211),
  p(286, "Lewis Bond", "Boston College", "WR", "5'10\"", 199),
  p(287, "Nic Anderson", "LSU", "WR", "6'4\"", 216),
  p(288, "Landon Robinson", "Navy", "DL5T", "6'0\"", 287),
  p(289, "Andre Fuller", "Toledo", "CB", "6'2\"", 202),
  p(291, "Vincent Anthony", "Duke", "EDGE", "6'6\"", 250),
  p(293, "Scooby Williams", "Texas A&M", "ILB", "6'2\"", 230),
  p(294, "Jeff Caldwell", "Cincinnati", "WR", "6'5\"", 215),
  p(295, "Seydou Traore", "Mississippi State", "TE", "6'4\"", 235),
  p(298, "Nyjalik Kelly", "UCF", "EDGE", "6'5\"", 265),
  p(299, "Will Kacmarek", "Ohio State", "TE", "6'6\"", 258),
  p(300, "Eli Heidenreich", "Navy", "WRS", "6'0\"", 206),
  p(302, "Behren Morton", "Texas Tech", "QB", "6'2\"", 210),
  p(305, "Rene Konga", "Louisville", "DL5T", "6'4\"", 300),
  p(306, "Joe Fagnano", "UConn", "QB", "6'4\"", 225),
  p(307, "Jalen Stroman", "Notre Dame", "S", "6'1\"", 201),
  p(308, "Eric O'Neill", "Rutgers", "EDGE", "6'3\"", 250),
  p(311, "Marlin Klein", "Michigan", "TE", "6'5\"", 250),
  p(312, "Brenen Thompson", "Mississippi State", "WRS", "5'9\"", 170),
  p(314, "Jalen McMurray", "Tennessee", "CB", "6'0\"", 187),
  p(315, "Karson Sharar", "Iowa", "ILB", "6'2\"", 235),
  p(316, "Romello Brinson", "SMU", "WR", "6'2\"", 190),
  p(317, "Fred Davis II", "Northwestern", "CB", "6'0\"", 197),
  p(323, "Kolbey Taylor", "Vanderbilt", "CB", "6'3\"", 190),
  p(324, "Luke Altmyer", "Illinois", "QB", "6'2\"", 205),
  p(325, "Treydan Stukes", "Arizona", "CB", "6'2\"", 200),
  p(327, "Dean Conners", "Houston", "RB", "6'0\"", 206),
  p(328, "Kahlil Saunders", "Kentucky", "DL3T", "6'4\"", 293),
  p(329, "Malik Spencer", "Michigan State", "S", "6'1\"", 192),
  p(330, "Jaydn Ott", "Oklahoma", "RB", "6'0\"", 210),
  p(331, "D.J. Rogers", "TCU", "TE", "6'4\"", 250),
  p(332, "Nick Andersen", "Wake Forest", "S", "5'11\"", 197),
  p(334, "Mark Gronowski", "Iowa", "QB", "6'2\"", 230),
  p(336, "Wydett Williams Jr.", "Ole Miss", "S", "6'2\"", 210),
  p(337, "Noah Thomas", "Georgia", "WR", "6'5\"", 200),
  p(338, "Micah Davey", "UTEP", "ILB", "6'2\"", 235),
  p(339, "Anthony Hankerson", "Oregon State", "RB", "5'8\"", 203),
  p(340, "Jacob De Jesus", "Cal", "WRS", "5'7\"", 170),
  p(341, "Sebastian Harsh", "NC State", "EDGE", "6'3\"", 263),
  p(343, "Karon Prunty", "Wake Forest", "CB", "6'2\"", 192),
  p(344, "Emmanuel Henderson", "Kansas", "WR", "6'1\"", 190),
  p(345, "Tyre West", "Tennessee", "DL5T", "6'3\"", 290),
  p(347, "Lance Mason", "Wisconsin", "TE", "6'4\"", 250),
  p(349, "Lake McRee", "USC", "TE", "6'4\"", 250),
  p(350, "Dalton Johnson", "Arizona", "S", "5'11\"", 198),
  p(351, "Joshua Eaton", "Michigan State", "CB", "6'1\"", 189),
  p(352, "Damonte Smith", "Middle Tennessee State", "DL3T", "6'1\"", 301),
  p(353, "John Michael Gyllenborg", "Wyoming", "TE", "6'5\"", 251),
  p(354, "Cole Wisniewski", "Texas Tech", "S", "6'3\"", 218),
  p(356, "Vinny Anthony II", "Wisconsin", "WR", "6'0\"", 190),
  p(357, "Desmond Reid", "Pittsburgh", "RB", "5'8\"", 175),
  p(358, "Eli Blakey", "Miami (OH)", "S", "6'2\"", 208),
  p(359, "Brylan Green", "Liberty", "S", "5'9\"", 180),
  p(360, "Michael Heldman", "Central Michigan", "EDGE", "6'4\"", 260),
  p(361, "Devin Voisin", "South Alabama", "WRS", "5'10\"", 182),
  p(362, "Jordan Hudson", "SMU", "WR", "6'1\"", 200),
  p(363, "Clayton Smith", "Arizona State", "EDGE", "6'4\"", 245),
  p(364, "Malik Benson", "Oregon", "WR", "6'1\"", 195),
  p(365, "Jalen Catalon", "Missouri", "S", "5'10\"", 205),
  p(366, "David Gusta", "Kentucky", "DL3T", "6'3\"", 302),
  p(369, "Clay Patterson", "Stanford", "EDGE", "6'3\"", 280),
  p(370, "Star Thomas", "Tennessee", "RB", "6'0\"", 210),
  p(371, "Rashad Battle", "Pitt", "CB", "6'3\"", 195),
  p(372, "Jaylon Guilbeau", "Texas", "CB", "6'0\"", 183),
  p(373, "Jacob Thomas", "James Madison", "S", "6'1\"", 212),
  p(374, "DeVonta Smith", "Notre Dame", "CB", "6'0\"", 205),
  p(375, "Eddie Walls III", "Houston", "EDGE", "6'4\"", 250),
  p(377, "Nathan Voorhis", "Ball State", "EDGE", "6'3\"", 247),
  p(378, "Dane Key", "Nebraska", "WR", "6'2\"", 210),
  p(380, "Ryan Davis", "Utah", "WRS", "5'10\"", 180),
  p(382, "DeCarlos Nicholson", "USC", "CB", "6'3\"", 200),
  p(385, "Keyshawn James-Newby", "New Mexico", "EDGE", "6'2\"", 244),
  p(388, "Skyler Thomas", "Oregon State", "S", "6'2\"", 212),
  p(389, "Gabriel Benyard", "Kennesaw State", "WRS", "5'10\"", 185),
  p(390, "Aaron Hall", "Duke", "DL3T", "6'4\"", 290),
  p(391, "Clayton Powell-Lee", "Georgia Tech", "S", "6'2\"", 200),
  p(393, "Jamal Haynes", "Georgia Tech", "RB", "5'9\"", 190),
  p(394, "Austin Brown", "Wisconsin", "S", "6'1\"", 215),
  p(395, "Cam Rice", "Maryland", "DL3T", "6'2\"", 303),
  p(399, "Cole Brevard", "Texas", "DL1T", "6'2\"", 346),
  p(400, "James Jackson", "Virginia", "ILB", "6'3\"", 234),
  p(402, "Kobe Prentice", "Baylor", "WRS", "5'10\"", 188),
  p(403, "Kentrel Bullock", "South Alabama", "RB", "5'10\"", 205),
  p(405, "Quintayvious Hutchins", "Boston College", "EDGE", "6'2\"", 242),
  p(406, "Latrell McCutchin Sr.", "Houston", "CB", "6'1\"", 185),
  p(408, "Robert Henry Jr.", "UTSA", "RB", "5'9\"", 205),
  p(410, "Max Tomczak", "Youngstown State", "WRS", "6'0\"", 195),
  p(411, "Daylan Carnell", "Missouri", "S", "6'2\"", 225),
  p(414, "Anthony Smith", "East Carolina", "WR", "6'3\"", 189),
  p(415, "Noah Short", "Army", "WR", "6'0\"", 195),
  p(417, "Isaiah Nwokobia", "SMU", "S", "6'1\"", 202),
  p(420, "Jeffrey M'Ba", "SMU", "DL3T", "6'5\"", 312),
  p(421, "Kris Hutson", "Arizona", "WRS", "5'10\"", 173),
  p(422, "Kapena Gushiken", "Ole Miss", "S", "6'0\"", 190),
  p(423, "Payton Zdroik", "Air Force", "DL5T", "6'0\"", 275),
  p(424, "Dillon Bell", "Georgia", "WR", "6'1\"", 210),
  p(426, "Jaren Kanak", "Oklahoma", "TE", "6'2\"", 233),
  p(427, "C.J. Donaldson", "Ohio State", "RB", "6'1\"", 232),
  p(429, "Carlos Allen Jr.", "Houston", "DL3T", "6'1\"", 295),
  p(430, "Josh Kattus", "Kentucky", "TE", "6'4\"", 247),
  p(433, "Dreyden Norwood", "Missouri", "CB", "6'0\"", 187),
  p(434, "Eric McAlister", "TCU", "WR", "6'3\"", 205),
  p(435, "Chamon Metayer", "Arizona State", "TE", "6'4\"", 255),
  p(436, "Michael Wortham", "Montana State", "WR", "5'9\"", 190),
  p(438, "Khordae Sydnor", "Vanderbilt", "EDGE", "6'3\"", 272),
  p(441, "Dominic Richardson", "Tulsa", "RB", "6'0\"", 210),
  p(442, "Toriano Pride Jr.", "Missouri", "CB", "5'10\"", 190),
  p(445, "Max Bredeson", "Michigan", "FB", "6'1\"", 250),
  p(447, "Ahmaad Moses", "SMU", "S", "5'10\"", 200),
  p(448, "Langston Patterson", "Vanderbilt", "ILB", "6'1\"", 235),
  p(450, "Keeshawn Silver", "USC", "DL1T", "6'4\"", 330),
  p(451, "Davon Booth", "Mississippi State", "RB", "5'9\"", 205),
  p(452, "Phillip Dunnam", "UCF", "S", "6'1\"", 195),
  p(454, "De'Shawn Rucker", "USF", "CB", "6'0\"", 195),
  p(455, "Anterio Thompson", "Washington", "DL3T", "6'3\"", 310),
  p(457, "Dasan McCullough", "Nebraska", "EDGE", "6'4\"", 235),
  p(458, "Matthew Hibner", "SMU", "TE", "6'4\"", 252),
  p(459, "Dominic Bailey", "Tennessee", "DL5T", "6'3\"", 292),
  p(460, "Aidan Hubbard", "Northwestern", "EDGE", "6'4\"", 255),
  p(462, "Channing Canada", "TCU", "CB", "6'1\"", 190),
  p(463, "Tony Grimes", "Purdue", "CB", "6'1\"", 190),
  p(466, "Lincoln Pare", "Texas State", "WR", "5'8\"", 200),
  p(467, "Trebor Pena", "Penn State", "WR", "5'11\"", 184),
  p(469, "Kejon Owens", "FIU", "RB", "5'10\"", 210),
  p(471, "Junior Vandeross III", "Toledo", "WRS", "5'8\"", 182),
  p(472, "Jackie Marshall", "Baylor", "DL5T", "6'3\"", 290),
  p(473, "D.T. Sheffield", "Rutgers", "WRS", "5'10\"", 175),
  p(476, "Ben Bell", "Virginia Tech", "EDGE", "6'2\"", 255),
  p(477, "Bangally Kamara", "Kansas", "LB", "6'2\"", 235),
  p(478, "Ayden Garnes", "Arizona", "CB", "6'0\"", 183),
  p(479, "Arden Walker", "Colorado", "EDGE", "6'2\"", 250),
  p(480, "Chase Wilson", "West Virginia", "ILB", "6'1\"", 230),
  p(481, "Devon Marshall", "NC State", "CB", "5'11\"", 200),
  p(482, "Zavion Thomas", "LSU", "WRS", "5'10\"", 192),
  p(484, "Haynes King", "Georgia Tech", "QB", "6'3\"", 215),
  p(486, "Khalil Dinkins", "Penn State", "TE", "6'4\"", 252),
  p(488, "Cole Kozlowski", "Central Florida", "ILB", "6'1\"", 230),
  p(489, "Isaiah Glasker", "BYU", "EDGE", "6'4\"", 235),
  p(490, "Preston Hodge", "Colorado", "CB", "5'11\"", 195),
  p(491, "Athan Kaliakmanis", "Rutgers", "QB", "6'3\"", 212),
  p(492, "Cash Jones", "Georgia", "RB", "5'11\"", 195),
  p(493, "Malick Sylla", "Mississippi State", "EDGE", "6'6\"", 255),
  p(494, "Jaidyn Denis", "Memphis", "CB", "6'2\"", 191),
  p(495, "Marvin Jones Jr.", "Oklahoma", "EDGE", "6'5\"", 255),
  p(496, "Donaven McCulley", "Michigan", "WR", "6'5\"", 215),
  p(497, "Blake Shapen", "Mississippi State", "QB", "6'1\"", 210),
  p(499, "Caleb Offord", "Kennesaw", "CB", "6'2\"", 198),
];

const SCOUTING_DATA: Record<string, DraftScoutingReport> = {
  "Fernando Mendoza": {
    strengths: ["elite arm strength with ability to make every throw", "improved pocket presence and reads", "strong leadership qualities", "excels under pressure"],
    weaknesses: ["accuracy can be inconsistent on intermediate routes", "limited mobility outside the pocket", "one-year starter with smaller sample size"],
    nflComparison: "Justin Herbert",
    draftProjection: "Top 5 Pick",
    fantasyOutlook: "Highest ceiling QB in the class. If he lands with a good offensive line, he has QB1 upside from Year 1. His arm talent is special and translates immediately to the NFL."
  },
  "Caleb Downs": {
    strengths: ["elite ball skills and range", "versatile enough to play multiple secondary positions", "high football IQ and instincts", "sure tackler in run support"],
    weaknesses: ["slightly undersized for a box safety role", "can be aggressive on double moves"],
    nflComparison: "Derwin James",
    draftProjection: "Top 5 Pick",
    fantasyOutlook: "Generational safety prospect. In IDP leagues, Downs projects as a DB1 immediately with his combination of tackles and splash plays. One of the safest picks in the draft."
  },
  "Rueben Bain Jr.": {
    strengths: ["relentless motor that never quits", "elite bend and flexibility", "disruptive against both run and pass", "quick first step"],
    weaknesses: ["could add more mass to hold up against NFL tackles", "limited pass rush repertoire beyond speed"],
    nflComparison: "Myles Garrett",
    draftProjection: "Top 5 Pick",
    fantasyOutlook: "Premium IDP asset with elite pass rush upside. Projects as a double-digit sack artist in the NFL. Top-3 EDGE prospect in recent memory for dynasty IDP leagues."
  },
  "Jeremiyah Love": {
    strengths: ["explosive speed with breakaway ability", "excellent vision and cutback ability", "dangerous in open field", "improving as a pass catcher"],
    weaknesses: ["slight frame may limit early-down work", "ball security needs improvement", "pass protection is a work in progress"],
    nflComparison: "Alvin Kamara",
    draftProjection: "Top 10 Pick",
    fantasyOutlook: "Dynamic playmaker who could be the RB1 in dynasty rookie drafts. His speed and receiving ability give him three-down potential. Landing spot is critical for Year 1 value."
  },
  "Carnell Tate": {
    strengths: ["smooth route runner with natural separation ability", "reliable hands and catch radius", "polished route tree", "competitive at the catch point"],
    weaknesses: ["not a burner deep threat", "slight frame could limit contested catch ability at NFL level"],
    nflComparison: "Keenan Allen",
    draftProjection: "Top 15 Pick",
    fantasyOutlook: "High-floor WR prospect with WR1 upside in the right offense. His route-running ability will translate immediately. Could be a PPR monster from Day 1."
  },
  "Makai Lemon": {
    strengths: ["physical receiver who wins after the catch", "excellent competitiveness and contested catches", "YAC ability is elite", "strong hands"],
    weaknesses: ["lacks top-end speed", "limited route tree development"],
    nflComparison: "Deebo Samuel",
    draftProjection: "Round 1 (15-25)",
    fantasyOutlook: "Versatile weapon who can be used in multiple ways. His YAC ability makes him a PPR darling. Could have WR2 value as a rookie with WR1 upside long-term."
  },
  "Jordyn Tyson": {
    strengths: ["smooth route runner with deep speed", "clean release off the line", "consistent hands", "good body control on sideline catches"],
    weaknesses: ["slight build may struggle with physical corners", "needs to improve run-after-catch ability"],
    nflComparison: "Chris Olave",
    draftProjection: "Round 1 (15-25)",
    fantasyOutlook: "Polished receiver who can contribute immediately. His route running and deep speed combo is rare. Projects as a high-floor WR2 with WR1 upside in the right system."
  },
  "Denzel Boston": {
    strengths: ["dominant contested catch ability", "excellent size-speed combination", "red zone weapon", "physical at the catch point"],
    weaknesses: ["route running needs refinement", "can be slow off the line"],
    nflComparison: "Mike Evans",
    draftProjection: "Round 1 (15-25)",
    fantasyOutlook: "His size and contested catch ability make him a red zone weapon. Could be a TD-dependent WR2 early but has WR1 ceiling. Think Mike Evans lite."
  },
  "Kenyon Sadiq": {
    strengths: ["athletic freak at tight end", "red zone matchup nightmare", "improving route running", "dangerous after the catch"],
    weaknesses: ["blocking needs significant improvement", "inconsistent effort on non-target plays"],
    nflComparison: "Kyle Pitts",
    draftProjection: "Round 1 (20-32)",
    fantasyOutlook: "Best TE prospect in the class with massive upside. If he lands with a pass-happy offense, he could be an immediate TE1. His athleticism at the position is rare."
  },
  "Ty Simpson": {
    strengths: ["dual-threat ability with strong legs", "improving arm talent", "competitive mentality", "can extend plays with mobility"],
    weaknesses: ["accuracy issues persist on deep balls", "decision-making under pressure needs work", "inconsistent pocket mechanics"],
    nflComparison: "Jalen Hurts",
    draftProjection: "Round 1 (25-32)",
    fantasyOutlook: "His rushing ability gives him a high floor in fantasy. If he develops as a passer, he has QB1 ceiling. Dynasty leagues should target him for his dual-threat upside."
  },
  "Anthony Hill Jr.": {
    strengths: ["sideline-to-sideline range", "instinctive linebacker with elite tackling", "strong leadership and communication", "versatile in coverage"],
    weaknesses: ["not a premium pass rusher", "can get washed out by bigger blockers"],
    nflComparison: "Roquan Smith",
    draftProjection: "Round 1 (15-25)",
    fantasyOutlook: "Elite IDP linebacker prospect. Projects as an immediate LB1 in tackle-heavy schemes. His range and instincts translate perfectly to the NFL. Top IDP pick."
  },
  "Dillon Thieneman": {
    strengths: ["elite range as a centerfield safety", "sure tackler in the open field", "instinctive ball hawk", "rapidly improving player"],
    weaknesses: ["can be too aggressive reading routes", "needs to refine technique in man coverage"],
    nflComparison: "Jessie Bates III",
    draftProjection: "Round 1 (20-32)",
    fantasyOutlook: "Rising fast on draft boards. His range and tackling ability make him an IDP goldmine. Could be a top-3 safety in IDP within two years."
  },
  "Peter Woods": {
    strengths: ["dominant interior presence", "collapses the pocket from the inside", "strong anchor against double teams", "high motor"],
    weaknesses: ["limited pass rush moves", "can be slow off the snap at times"],
    nflComparison: "Chris Jones",
    draftProjection: "Top 15 Pick",
    fantasyOutlook: "Premium IDP interior defender. His disruption ability translates to sacks and TFLs at the NFL level. DL1 upside in deeper IDP formats."
  },
  "Keldric Faulk": {
    strengths: ["powerful run defender with pass rush upside", "excellent anchor and leverage", "long arms create problems for offensive linemen"],
    weaknesses: ["limited burst as a pass rusher", "needs to develop counter moves"],
    nflComparison: "Arik Armstead",
    draftProjection: "Top 15 Pick",
    fantasyOutlook: "Solid IDP prospect who will contribute in multiple categories. His run defense is elite and he adds pass rush value. DL2 floor with DL1 potential."
  },
  "T.J. Parker": {
    strengths: ["long arms and excellent technique", "high-floor pass rusher", "strong motor and effort", "good in run defense"],
    weaknesses: ["lacks elite bend", "not a dynamic athlete"],
    nflComparison: "Bud Dupree",
    draftProjection: "Round 1 (20-32)",
    fantasyOutlook: "Safe EDGE prospect with 8+ sack potential annually. Won't wow you but provides consistent IDP production. EDGE2 with sneaky upside."
  },
  "Cade Klubnik": {
    strengths: ["poise under pressure", "strong leadership on and off the field", "improved accuracy and decision-making", "good mobility"],
    weaknesses: ["arm strength is just average", "can struggle against elite pass rushes"],
    nflComparison: "Dak Prescott",
    draftProjection: "Round 1 (25-32)",
    fantasyOutlook: "Stock skyrocketing after breakout 2025 season. His improvement arc is impressive. Could be a QB1 in the right system. Dynasty sleeper at the QB position."
  },
  "Zachariah Branch": {
    strengths: ["electric speed and elusiveness", "dangerous in open space", "dynamic return ability", "creates explosive plays"],
    weaknesses: ["very slight frame", "limited route tree", "durability concerns at his size"],
    nflComparison: "Tyreek Hill (lite)",
    draftProjection: "Round 2 (35-50)",
    fantasyOutlook: "His speed is game-changing but the slight frame is a concern. In the right offense, he could be a WR2 with boom weeks. Think Tyreek Hill with less polish."
  },
  "Carson Beck": {
    strengths: ["elite arm talent when healthy", "strong pre-snap reads", "experience in SEC"],
    weaknesses: ["coming off ACL tear", "turnover-prone tendencies", "medical concerns cloud outlook"],
    nflComparison: "Sam Darnold",
    draftProjection: "Round 2-3",
    fantasyOutlook: "Massive talent but the ACL injury and turnovers create significant risk. Could be a dynasty value if he falls in the draft. High ceiling, low floor."
  },
  "Garrett Nussmeier": {
    strengths: ["competitive fire and toughness", "good arm talent", "willing to take shots downfield"],
    weaknesses: ["turnover-prone decision-making", "tries to force throws into tight windows", "pocket awareness needs improvement"],
    nflComparison: "Baker Mayfield",
    draftProjection: "Round 2-3",
    fantasyOutlook: "Has the arm but the turnovers are a real concern. Could develop into a solid starter or flame out. Dynasty dart throw with potential."
  },
  "Drew Allar": {
    strengths: ["prototypical size and arm strength", "can make every throw"],
    weaknesses: ["inconsistent decision-making", "struggled against top competition in 2025", "mechanical issues under pressure"],
    nflComparison: "Paxton Lynch",
    draftProjection: "Round 2-3",
    fantasyOutlook: "The tools are all there but the tape doesn't match the measurables. Falling stock means he could be a value pick. High risk, high reward dynasty QB."
  },
  "Davison Igbinosun": {
    strengths: ["exceptional length for the position", "elite ball skills and ball tracking", "physical at the line of scrimmage", "improving technique"],
    weaknesses: ["can get beat by quick routes underneath", "hip stiffness in transitions"],
    nflComparison: "Sauce Gardner",
    draftProjection: "Round 1 (15-25)",
    fantasyOutlook: "Top corner prospect with CB1 IDP potential. His length and ball skills create turnover opportunities. Premium IDP asset in leagues that value corners."
  },
  "Deontae Lawson": {
    strengths: ["elite play recognition and communication", "QB of the defense", "consistent tackler", "good in coverage for his size"],
    weaknesses: ["not elite athletically", "can struggle in space against dynamic backs"],
    nflComparison: "Zack Baun",
    draftProjection: "Round 1-2",
    fantasyOutlook: "High-floor IDP linebacker. Will rack up tackles from Day 1. Think 100+ tackle guy annually. LB2 floor with LB1 upside in the right scheme."
  },
  "Nick Singleton": {
    strengths: ["powerful runner between the tackles", "good vision", "durable build"],
    weaknesses: ["limited receiving role hurts dynasty value", "not explosive in open field", "one-dimensional running style"],
    nflComparison: "Josh Jacobs",
    draftProjection: "Round 2-3",
    fantasyOutlook: "Power back who may be drafted higher than his fantasy value suggests. Limited passing game involvement caps his ceiling. RB2 range in dynasty."
  },
  "Eli Stowers": {
    strengths: ["solid all-around tight end", "reliable blocker", "improving route runner"],
    weaknesses: ["not a dynamic athlete", "limited big-play ability"],
    nflComparison: "Austin Hooper",
    draftProjection: "Round 2-3",
    fantasyOutlook: "Solid TE prospect but not a fantasy difference-maker. Will be a better NFL player than fantasy player. TE2 range at best."
  },
  "Mansoor Delane": {
    strengths: ["physical corner with good ball skills", "aggressive tackler", "good length"],
    weaknesses: ["can be grabby in coverage", "needs to clean up technique"],
    nflComparison: "Marshon Lattimore",
    draftProjection: "Round 1-2",
    fantasyOutlook: "Solid IDP corner prospect. His physicality translates well. CB2 with CB1 upside if he cleans up the penalties."
  },
  "Christen Miller": {
    strengths: ["disruptive interior lineman", "quick first step for his size", "good motor"],
    weaknesses: ["inconsistent effort at times", "needs to develop more pass rush moves"],
    nflComparison: "Javon Kinlaw",
    draftProjection: "Round 1-2",
    fantasyOutlook: "Interior DL with pass rush upside. Could be a sneaky IDP pick if he develops his pass rush. DL2 range with upside."
  },
  "Demond Claiborne": {
    strengths: ["explosive speed and quickness", "dynamic in the passing game", "dangerous return man"],
    weaknesses: ["very small frame", "durability is a major concern", "limited between-the-tackles ability"],
    nflComparison: "Nyheim Hines",
    draftProjection: "Round 3-4",
    fantasyOutlook: "Electric playmaker in space but size limits his role. Could carve out a receiving back niche. PPR value as a flex option."
  },
  "Jonah Coleman": {
    strengths: ["powerful compact runner", "excellent balance and contact balance", "productive in multiple systems"],
    weaknesses: ["short stature limits vision behind the line", "not a burner", "durability questions with his running style"],
    nflComparison: "Marshawn Lynch (lite)",
    draftProjection: "Round 2-3",
    fantasyOutlook: "Fun runner to watch with good contact balance. Could be an early-down grinder. RB2 range in dynasty with goal-line upside."
  },
  "Jadarian Price": {
    strengths: ["balanced runner with good vision", "reliable pass catcher", "patient in the hole"],
    weaknesses: ["not explosive", "lacks top-end speed", "average size"],
    nflComparison: "David Montgomery",
    draftProjection: "Round 3-4",
    fantasyOutlook: "Steady back who does everything well but nothing elite. Could be a late-round dynasty value. RB3 with flex appeal."
  },
  "Kaytron Allen": {
    strengths: ["powerful between the tackles", "good short-yardage back", "durable build"],
    weaknesses: ["limited in the passing game", "not explosive", "pedestrian speed"],
    nflComparison: "Damien Harris",
    draftProjection: "Round 3-4",
    fantasyOutlook: "Early-down grinder with TD upside near the goal line. Limited ceiling in PPR formats. Best suited as a dynasty RB3/flex."
  },
  "Chris Brazzell II": {
    strengths: ["excellent size at 6'5\"", "deep threat ability", "physical at the catch point", "improving route running"],
    weaknesses: ["can body catch too much", "routes are still raw", "concentration drops"],
    nflComparison: "DK Metcalf (lite)",
    draftProjection: "Round 2-3",
    fantasyOutlook: "Physical freak with deep threat ability. If he refines his route running, he could be a steal. WR3 range with WR1 ceiling long-term."
  },
  "Max Klare": {
    strengths: ["good size and athleticism", "improving blocker", "red zone target"],
    weaknesses: ["raw as a route runner", "inconsistent hands"],
    nflComparison: "Hayden Hurst",
    draftProjection: "Round 2-3",
    fantasyOutlook: "Developmental TE with athletic upside. Could emerge as a TE2 option in Year 2-3. Patient dynasty stash."
  },
  "Oscar Delp": {
    strengths: ["smooth athlete at tight end", "natural hands", "good route runner for the position"],
    weaknesses: ["needs to add strength", "blocking is below average"],
    nflComparison: "Evan Engram",
    draftProjection: "Round 2-3",
    fantasyOutlook: "Move tight end who can create mismatches. If he lands in a TE-friendly offense, he has TE1 upside. Top-3 TE in the class."
  },
  "Diego Pavia": {
    strengths: ["incredible dual-threat ability", "competitor and winner", "improvisation skills"],
    weaknesses: ["undersized for an NFL QB", "arm strength is limited", "older prospect"],
    nflComparison: "Russell Wilson (early career)",
    draftProjection: "Round 3-5",
    fantasyOutlook: "His rushing ability gives him a fantasy floor but the lack of arm talent limits his ceiling. Could be a fun backup/spot starter with rushing upside."
  },
  "Desmond Reid": {
    strengths: ["explosive speed", "excellent receiving ability", "dynamic playmaker in space", "return game value"],
    weaknesses: ["tiny frame at 5'8\" 175 lbs", "durability is a major concern", "can't handle heavy workloads between the tackles"],
    nflComparison: "Deuce Vaughn / Tarik Cohen",
    draftProjection: "Round 4-5",
    fantasyOutlook: "Electric player but his size severely limits his NFL role. PPR specialist who could have value as a pass-catching back. High risk dynasty pick."
  },
};

for (const player of DRAFT_2026_PLAYERS) {
  if (SCOUTING_DATA[player.name]) {
    player.scouting = SCOUTING_DATA[player.name];
  }
}

export function getDraft2026Players(filters?: { side?: string; positionGroup?: string; search?: string }): Draft2026Player[] {
  let result = [...DRAFT_2026_PLAYERS];

  if (filters?.side) {
    result = result.filter(p => p.side === filters.side);
  }

  if (filters?.positionGroup) {
    result = result.filter(p => p.positionGroup === filters.positionGroup);
  }

  if (filters?.search) {
    const search = filters.search.toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(search) ||
      p.college.toLowerCase().includes(search) ||
      p.position.toLowerCase().includes(search)
    );
  }

  return result.sort((a, b) => a.rank - b.rank);
}

export function getDraft2026PositionGroups(): string[] {
  const groups = new Set(DRAFT_2026_PLAYERS.map(p => p.positionGroup));
  return Array.from(groups).sort();
}

export function getDraft2026Stats(): { total: number; offense: number; defense: number; byPosition: Record<string, number> } {
  const byPosition: Record<string, number> = {};

  let offense = 0;
  let defense = 0;

  for (const player of DRAFT_2026_PLAYERS) {
    if (player.side === 'offense') offense++;
    else defense++;

    byPosition[player.positionGroup] = (byPosition[player.positionGroup] || 0) + 1;
  }

  return {
    total: DRAFT_2026_PLAYERS.length,
    offense,
    defense,
    byPosition,
  };
}

export function getDraft2026StockMovers(): { rising: Draft2026Player[]; falling: Draft2026Player[] } {
  const rising = DRAFT_2026_PLAYERS.filter(p => p.stockStatus === 'rising').sort((a, b) => b.stockChange - a.stockChange);
  const falling = DRAFT_2026_PLAYERS.filter(p => p.stockStatus === 'falling').sort((a, b) => a.stockChange - b.stockChange);
  return { rising, falling };
}
