-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Apr 19, 2026 at 09:27 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `lumbis-activity-2`
--

DELIMITER $$
--
-- Procedures
--
CREATE DEFINER=`root`@`localhost` PROCEDURE `add_pgp` (IN `p_pid` INT, IN `p_gpid` INT)   BEGIN
  INSERT INTO player_gamepasses (pid, gpid, src, act)
  VALUES (p_pid, p_gpid, 'purchase', 1);
END$$

--
-- Functions
--
CREATE DEFINER=`root`@`localhost` FUNCTION `has_gamepass` (`p_pid` INT, `p_gpid` INT) RETURNS INT(11) DETERMINISTIC BEGIN
  DECLARE c INT;

  SELECT COUNT(*)
  INTO c
  FROM player_gamepasses
  WHERE pid = p_pid
    AND gpid = p_gpid
    AND act = 1;

  RETURN IF(c > 0, 1, 0);
END$$

DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `benefit_types`
--

CREATE TABLE `benefit_types` (
  `bid` int(11) NOT NULL,
  `bcode` varchar(40) NOT NULL,
  `bname` varchar(80) NOT NULL,
  `bdesc` varchar(255) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `benefit_types`
--

INSERT INTO `benefit_types` (`bid`, `bcode`, `bname`, `bdesc`) VALUES
(1, 'VIP_TAG', 'VIP Tag', 'shows vip tag'),
(2, 'COIN_MULTI', 'Coin Multiplier', 'coins multiplier'),
(3, 'XP_MULTI', 'XP Multiplier', 'xp multiplier'),
(4, 'INV_SLOTS', 'Inventory Slots', 'extra inventory slots'),
(5, 'SPD_BONUS', 'Speed Bonus', 'walk speed bonus'),
(6, 'PET_SLOTS', 'Pet Slots', 'extra pet equip slots'),
(7, 'AUTO_COLLECT', 'Auto Collect', 'auto collect drops'),
(8, 'TP_MENU', 'Teleport Menu', 'unlock teleport'),
(9, 'NAME_COLOR', 'Name Color', 'special name color'),
(10, 'BUNDLE', 'Bundle', 'starter bundle');

-- --------------------------------------------------------

--
-- Table structure for table `gamepasses`
--

CREATE TABLE `gamepasses` (
  `gpid` int(11) NOT NULL,
  `gname` varchar(80) NOT NULL,
  `descr` varchar(255) DEFAULT NULL,
  `price` int(11) NOT NULL,
  `sale` int(11) NOT NULL DEFAULT 1,
  `cat` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `gamepasses`
--

INSERT INTO `gamepasses` (`gpid`, `gname`, `descr`, `price`, `sale`, `cat`) VALUES
(1, 'vip', 'vip tag', 199, 1, '2025-01-01 02:00:00'),
(2, 'x2coins', 'double coins', 299, 1, '2025-01-01 02:05:00'),
(3, 'x2xp', 'double xp', 249, 1, '2025-01-01 02:10:00'),
(4, 'invplus', '+50 slots', 149, 1, '2025-01-01 02:15:00'),
(5, 'speed', '+10% speed', 179, 1, '2025-01-01 02:20:00'),
(6, 'petslot', '+1 pet slot', 129, 1, '2025-01-01 02:25:00'),
(7, 'autocollect', 'auto pick items', 399, 1, '2025-01-01 02:30:00'),
(8, 'teleport', 'teleport menu', 99, 1, '2025-01-01 02:35:00'),
(9, 'goldname', 'gold name', 59, 1, '2025-01-01 02:40:00'),
(10, 'giftpack', 'admin pack', 0, 0, '2025-01-01 02:45:00');

-- --------------------------------------------------------

--
-- Table structure for table `gamepass_benefits`
--

CREATE TABLE `gamepass_benefits` (
  `gpid` int(11) NOT NULL,
  `bid` int(11) NOT NULL,
  `val` varchar(80) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `gamepass_benefits`
--

INSERT INTO `gamepass_benefits` (`gpid`, `bid`, `val`) VALUES
(1, 1, 'VIP'),
(2, 2, '2'),
(3, 3, '2'),
(4, 4, '50'),
(5, 5, '10'),
(6, 6, '1'),
(7, 7, '1'),
(8, 8, '1'),
(9, 9, 'Gold'),
(10, 10, 'PackA');

-- --------------------------------------------------------

--
-- Table structure for table `players`
--

CREATE TABLE `players` (
  `pid` int(11) NOT NULL,
  `uname` varchar(50) NOT NULL,
  `jdate` date NOT NULL,
  `stat` varchar(20) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `players`
--

INSERT INTO `players` (`pid`, `uname`, `jdate`, `stat`) VALUES
(1, 'FreeSkin', '2025-01-01', 'active'),
(2, 'MoonByte', '2025-01-02', 'active'),
(3, 'PixelNova', '2025-01-03', 'active'),
(4, 'RbxRanger', '2025-01-04', 'active'),
(5, 'KaitoDev', '2025-01-05', 'active'),
(6, 'LavaLynx', '2025-01-06', 'active'),
(7, 'NeonWarden', '2025-01-07', 'active'),
(8, 'SushiSamurai', '2025-01-08', 'active'),
(9, 'CloudCrate', '2025-01-09', 'banned'),
(10, 'AstraPanda', '2025-01-10', 'active');

-- --------------------------------------------------------

--
-- Table structure for table `player_gamepasses`
--

CREATE TABLE `player_gamepasses` (
  `pid` int(11) NOT NULL,
  `gpid` int(11) NOT NULL,
  `atime` timestamp NOT NULL DEFAULT current_timestamp(),
  `src` varchar(20) NOT NULL DEFAULT 'purchase',
  `act` int(11) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `player_gamepasses`
--

INSERT INTO `player_gamepasses` (`pid`, `gpid`, `atime`, `src`, `act`) VALUES
(1, 1, '2025-01-02 03:00:00', 'purchase', 1),
(2, 2, '2025-01-02 03:05:00', 'purchase', 1),
(3, 3, '2025-01-02 03:10:00', 'gift', 1),
(4, 4, '2025-01-02 03:15:00', 'purchase', 1),
(5, 5, '2025-01-02 03:20:00', 'purchase', 1),
(6, 6, '2025-01-02 03:25:00', 'promo', 1),
(7, 7, '2025-01-02 03:30:00', 'purchase', 1),
(8, 8, '2025-01-02 03:35:00', 'purchase', 1),
(9, 9, '2025-01-02 03:40:00', 'purchase', 0),
(10, 10, '2025-01-02 03:45:00', 'admin', 1);

--
-- Triggers `player_gamepasses`
--
DELIMITER $$
CREATE TRIGGER `gp_delete` AFTER DELETE ON `player_gamepasses` FOR EACH ROW BEGIN
    INSERT INTO `player_gamepasses_audit`
    (`action_type`, `pid`, `gpid`, `old_src`, `new_src`, `old_act`, `new_act`)
    VALUES
    ('DELETE', OLD.pid, OLD.gpid, OLD.src, NULL, OLD.act, NULL);
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `gp_insert` AFTER INSERT ON `player_gamepasses` FOR EACH ROW BEGIN
    INSERT INTO `player_gamepasses_audit`
    (`action_type`, `pid`, `gpid`, `old_src`, `new_src`, `old_act`, `new_act`)
    VALUES
    ('INSERT', NEW.pid, NEW.gpid, NULL, NEW.src, NULL, NEW.act);
END
$$
DELIMITER ;
DELIMITER $$
CREATE TRIGGER `gp_update` AFTER UPDATE ON `player_gamepasses` FOR EACH ROW BEGIN
    INSERT INTO `player_gamepasses_audit`
    (`action_type`, `pid`, `gpid`, `old_src`, `new_src`, `old_act`, `new_act`)
    VALUES
    ('UPDATE', NEW.pid, NEW.gpid, OLD.src, NEW.src, OLD.act, NEW.act);
END
$$
DELIMITER ;

-- --------------------------------------------------------

--
-- Table structure for table `player_gamepasses_audit`
--

CREATE TABLE `player_gamepasses_audit` (
  `audit_id` int(11) NOT NULL,
  `action_type` varchar(10) NOT NULL,
  `pid` int(11) NOT NULL,
  `gpid` int(11) NOT NULL,
  `old_src` varchar(20) DEFAULT NULL,
  `new_src` varchar(20) DEFAULT NULL,
  `old_act` int(11) DEFAULT NULL,
  `new_act` int(11) DEFAULT NULL,
  `action_time` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `player_gamepasses_audit`
--

INSERT INTO `player_gamepasses_audit` (`audit_id`, `action_type`, `pid`, `gpid`, `old_src`, `new_src`, `old_act`, `new_act`, `action_time`) VALUES
(1, 'INSERT', 1, 4, NULL, 'purchase', NULL, 1, '2026-03-11 13:29:05'),
(2, 'UPDATE', 1, 4, 'purchase', 'purchase', 1, 0, '2026-03-11 13:30:42'),
(3, 'UPDATE', 1, 4, 'purchase', 'gifting', 0, 0, '2026-03-11 13:31:26'),
(4, 'DELETE', 1, 4, 'gifting', NULL, 0, NULL, '2026-03-11 13:32:13');

-- --------------------------------------------------------

--
-- Stand-in structure for view `player_names`
-- (See below for the actual view)
--
CREATE TABLE `player_names` (
`pid` int(11)
,`uname` varchar(50)
,`stat` varchar(20)
,`jdate` date
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_player_gamepasses`
-- (See below for the actual view)
--
CREATE TABLE `vw_player_gamepasses` (
`pid` int(11)
,`uname` varchar(50)
,`gpid` int(11)
,`gname` varchar(80)
,`src` varchar(20)
,`act` int(11)
);

-- --------------------------------------------------------

--
-- Stand-in structure for view `vw_player_pass_count`
-- (See below for the actual view)
--
CREATE TABLE `vw_player_pass_count` (
`pid` int(11)
,`uname` varchar(50)
,`owned_gamepasses` bigint(21)
);

-- --------------------------------------------------------

--
-- Structure for view `player_names`
--
DROP TABLE IF EXISTS `player_names`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `player_names`  AS SELECT `players`.`pid` AS `pid`, `players`.`uname` AS `uname`, `players`.`stat` AS `stat`, `players`.`jdate` AS `jdate` FROM `players` ;

-- --------------------------------------------------------

--
-- Structure for view `vw_player_gamepasses`
--
DROP TABLE IF EXISTS `vw_player_gamepasses`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vw_player_gamepasses`  AS SELECT `p`.`pid` AS `pid`, `p`.`uname` AS `uname`, `g`.`gpid` AS `gpid`, `g`.`gname` AS `gname`, `pg`.`src` AS `src`, `pg`.`act` AS `act` FROM ((`player_gamepasses` `pg` join `players` `p` on(`p`.`pid` = `pg`.`pid`)) join `gamepasses` `g` on(`g`.`gpid` = `pg`.`gpid`)) ;

-- --------------------------------------------------------

--
-- Structure for view `vw_player_pass_count`
--
DROP TABLE IF EXISTS `vw_player_pass_count`;

CREATE ALGORITHM=UNDEFINED DEFINER=`root`@`localhost` SQL SECURITY DEFINER VIEW `vw_player_pass_count`  AS SELECT `p`.`pid` AS `pid`, `p`.`uname` AS `uname`, count(`pg`.`gpid`) AS `owned_gamepasses` FROM (`players` `p` left join `player_gamepasses` `pg` on(`pg`.`pid` = `p`.`pid` and `pg`.`act` = 1)) GROUP BY `p`.`pid`, `p`.`uname` ;

--
-- Indexes for dumped tables
--

--
-- Indexes for table `benefit_types`
--
ALTER TABLE `benefit_types`
  ADD PRIMARY KEY (`bid`),
  ADD UNIQUE KEY `bcode` (`bcode`);

--
-- Indexes for table `gamepasses`
--
ALTER TABLE `gamepasses`
  ADD PRIMARY KEY (`gpid`),
  ADD UNIQUE KEY `gname` (`gname`);

--
-- Indexes for table `gamepass_benefits`
--
ALTER TABLE `gamepass_benefits`
  ADD PRIMARY KEY (`gpid`,`bid`),
  ADD KEY `bid` (`bid`);

--
-- Indexes for table `players`
--
ALTER TABLE `players`
  ADD PRIMARY KEY (`pid`),
  ADD UNIQUE KEY `uname` (`uname`);

--
-- Indexes for table `player_gamepasses`
--
ALTER TABLE `player_gamepasses`
  ADD PRIMARY KEY (`pid`,`gpid`),
  ADD KEY `gpid` (`gpid`);

--
-- Indexes for table `player_gamepasses_audit`
--
ALTER TABLE `player_gamepasses_audit`
  ADD PRIMARY KEY (`audit_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `player_gamepasses_audit`
--
ALTER TABLE `player_gamepasses_audit`
  MODIFY `audit_id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `gamepass_benefits`
--
ALTER TABLE `gamepass_benefits`
  ADD CONSTRAINT `gamepass_benefits_fk1` FOREIGN KEY (`gpid`) REFERENCES `gamepasses` (`gpid`),
  ADD CONSTRAINT `gamepass_benefits_fk2` FOREIGN KEY (`bid`) REFERENCES `benefit_types` (`bid`);

--
-- Constraints for table `player_gamepasses`
--
ALTER TABLE `player_gamepasses`
  ADD CONSTRAINT `player_gamepasses_fk1` FOREIGN KEY (`pid`) REFERENCES `players` (`pid`),
  ADD CONSTRAINT `player_gamepasses_fk2` FOREIGN KEY (`gpid`) REFERENCES `gamepasses` (`gpid`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
