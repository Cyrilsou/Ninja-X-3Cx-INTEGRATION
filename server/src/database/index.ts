import { Sequelize, DataTypes } from 'sequelize';
import config from 'config';
import { Logger } from '@3cx-ninja/shared';
import path from 'path';

const logger = new Logger('Database');

// Configuration de la base de données
const dbConfig = config.get<any>('database');

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
    type: DataTypes.STRING,
    primaryKey: true
  },
  extension: DataTypes.STRING,
  agentEmail: DataTypes.STRING,
  caller: DataTypes.STRING,
  callee: DataTypes.STRING,
  direction: DataTypes.STRING,
  startTime: DataTypes.DATE,
  endTime: DataTypes.DATE,
  duration: DataTypes.INTEGER,
  status: DataTypes.STRING,
  recordingUrl: DataTypes.STRING
});

export const AgentModel = sequelize.define('Agent', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING,
    unique: true
  },
  name: DataTypes.STRING,
  extension: DataTypes.STRING,
  status: DataTypes.STRING,
  version: DataTypes.STRING,
  ipAddress: DataTypes.STRING,
  lastSeen: DataTypes.DATE
});

export const TranscriptionModel = sequelize.define('Transcription', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  callId: {
    type: DataTypes.STRING,
    references: {
      model: CallModel,
      key: 'callId'
    }
  },
  text: DataTypes.TEXT,
  language: DataTypes.STRING,
  confidence: DataTypes.FLOAT,
  segments: DataTypes.JSON,
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending'
  }
});

export const AnalysisModel = sequelize.define('Analysis', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  callId: {
    type: DataTypes.STRING,
    references: {
      model: CallModel,
      key: 'callId'
    }
  },
  transcriptionId: DataTypes.INTEGER,
  summary: DataTypes.TEXT,
  mainIssue: DataTypes.TEXT,
  customerSentiment: DataTypes.STRING,
  sentiment: DataTypes.FLOAT,
  category: DataTypes.STRING,
  priority: DataTypes.STRING,
  suggestedTitle: DataTypes.STRING,
  actionItems: DataTypes.JSON,
  keywords: DataTypes.JSON,
  ticketCreated: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

export const TicketModel = sequelize.define('Ticket', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  callId: {
    type: DataTypes.STRING,
    references: {
      model: CallModel,
      key: 'callId'
    }
  },
  ninjaTicketId: DataTypes.INTEGER,
  title: DataTypes.STRING,
  status: DataTypes.STRING,
  createdBy: DataTypes.STRING
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

// Export initDatabase pour compatibilité
export const initDatabase = setupDatabase;

export { sequelize };