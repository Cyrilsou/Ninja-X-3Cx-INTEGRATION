import { Sequelize } from 'sequelize';
import config from 'config';
import { Logger } from '@3cx-ninja/shared';
import path from 'path';

const logger = new Logger('Database');

// Configuration de la base de données
const dbConfig = config.get('database') as any;

// Utiliser SQLite par défaut
const sequelize = new Sequelize({
  dialect: dbConfig.dialect || 'sqlite',
  storage: dbConfig.storage || path.join(__dirname, '../../data/database.sqlite'),
  logging: dbConfig.logging === true ? console.log : false,
  define: {
    timestamps: true,
    underscored: true
  }
});

// Modèles
export const CallModel = sequelize.define('Call', {
  callId: {
    type: Sequelize.STRING,
    primaryKey: true
  },
  extension: Sequelize.STRING,
  agentEmail: Sequelize.STRING,
  caller: Sequelize.STRING,
  callee: Sequelize.STRING,
  direction: Sequelize.STRING,
  startTime: Sequelize.DATE,
  endTime: Sequelize.DATE,
  duration: Sequelize.INTEGER,
  status: Sequelize.STRING
});

export const TranscriptionModel = sequelize.define('Transcription', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  callId: {
    type: Sequelize.STRING,
    references: {
      model: CallModel,
      key: 'callId'
    }
  },
  text: Sequelize.TEXT,
  language: Sequelize.STRING,
  confidence: Sequelize.FLOAT,
  segments: Sequelize.JSON
});

export const AnalysisModel = sequelize.define('Analysis', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  callId: {
    type: Sequelize.STRING,
    references: {
      model: CallModel,
      key: 'callId'
    }
  },
  summary: Sequelize.TEXT,
  mainIssue: Sequelize.TEXT,
  customerSentiment: Sequelize.STRING,
  category: Sequelize.STRING,
  priority: Sequelize.STRING,
  suggestedTitle: Sequelize.STRING,
  actionItems: Sequelize.JSON,
  keywords: Sequelize.JSON
});

export const TicketModel = sequelize.define('Ticket', {
  id: {
    type: Sequelize.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  callId: {
    type: Sequelize.STRING,
    references: {
      model: CallModel,
      key: 'callId'
    }
  },
  ninjaTicketId: Sequelize.INTEGER,
  title: Sequelize.STRING,
  status: Sequelize.STRING,
  createdBy: Sequelize.STRING
});

// Relations
CallModel.hasOne(TranscriptionModel, { foreignKey: 'callId' });
CallModel.hasOne(AnalysisModel, { foreignKey: 'callId' });
CallModel.hasOne(TicketModel, { foreignKey: 'callId' });

TranscriptionModel.belongsTo(CallModel, { foreignKey: 'callId' });
AnalysisModel.belongsTo(CallModel, { foreignKey: 'callId' });
TicketModel.belongsTo(CallModel, { foreignKey: 'callId' });

// Fonction de configuration
export async function setupDatabase() {
  try {
    await sequelize.authenticate();
    logger.info('Database connection established');
    
    // Créer les tables si elles n'existent pas
    await sequelize.sync({ alter: true });
    logger.info('Database synchronized');
    
  } catch (error) {
    logger.error('Database setup failed:', error);
    throw error;
  }
}

export { sequelize };