const {pool} = require('../config/db');

class AchievementsModel {
  static async getAchievements() {
    try {
      const [sessions] = await pool.query(
        'SELECT s.stadium_id, s.coach_id, s.status, s.created_at, u.first_name, u.last_name ' +
        'FROM sessions s ' +
        'LEFT JOIN users u ON s.coach_id = u.id ' +
        'WHERE s.status = ? AND s.created_at >= ?',
        ['available', '2025-07-01 00:00:00']
      );
      console.log('Fetched sessions:', sessions);

      const totalUnlocked = sessions.length;
      const topAchiever = this.getTopAchiever(sessions);
      const mostActiveModule = this.getMostActiveModule(sessions);
      const mostRecent = this.getMostRecentAchievement(sessions);

      return { totalUnlocked, topAchiever, mostActiveModule, mostRecent };
    } catch (error) {
      console.error('Error fetching achievements:', error);
      throw new Error('Failed to fetch achievements');
    }
  }

  static getTopAchiever(sessions) {
    console.log('Sessions data:', sessions);
    if (!sessions.length) return 'N/A';
    // Filter out sessions with null coach_id
    const validSessions = sessions.filter(session => session.coach_id !== null && session.coach_id !== undefined);
    if (!validSessions.length) return 'N/A';
    const coachSessions = validSessions.reduce((acc, session) => {
      acc[session.coach_id] = (acc[session.coach_id] || 0) + 1;
      return acc;
    }, {});
    console.log('Coach sessions count:', coachSessions);
    const topCoachId = Object.keys(coachSessions).reduce((a, b) => coachSessions[a] > coachSessions[b] ? a : b);
    const topCoach = validSessions.find(s => s.coach_id === parseInt(topCoachId));
    console.log('Top coach data:', topCoach);
    return topCoach ? `${topCoach.first_name} ${topCoach.last_name}` : 'N/A';
  }

  static getMostActiveModule(sessions) {
    if (!sessions.length) return 'N/A';
    const moduleCount = { Player: 0, Coach: 0 };
    sessions.forEach(session => {
      if (session.coach_id) moduleCount.Coach++;
      else moduleCount.Player++;
    });
    return Object.keys(moduleCount).reduce((a, b) => moduleCount[a] > moduleCount[b] ? a : b);
  }

  static getMostRecentAchievement(sessions) {
    if (!sessions.length) return 'N/A';
    const sortedSessions = sessions.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return sortedSessions.length >= 100 ? '100 Matches Played' : 'N/A';
  }
}

module.exports = AchievementsModel;