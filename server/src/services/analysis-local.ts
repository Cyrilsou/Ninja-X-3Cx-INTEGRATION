import { CallAnalysis, Transcription } from '@3cx-ninja/shared';
import { Logger, extractKeywords } from '@3cx-ninja/shared';

export class AnalysisLocalService {
  private logger = new Logger('AnalysisLocal');

  async analyzeCall(
    transcription: Transcription,
    callContext: any & { recordingUrl?: string }
  ): Promise<CallAnalysis> {
    try {
      const text = transcription.text.toLowerCase();
      
      // Extraction du problème principal
      const mainIssue = this.extractMainIssue(text);
      
      // Analyse du sentiment
      const sentiment = this.analyzeSentiment(text);
      
      // Extraction des actions
      const actionItems = this.extractActionItems(text);
      
      // Catégorisation
      const category = this.categorizeCall(text);
      
      // Détermination de la priorité
      const priority = this.determinePriority(text, sentiment);
      
      // Génération du résumé
      const summary = this.generateSummary(transcription);
      
      // Extraction des mots-clés
      const keywords = extractKeywords(text);
      
      // Titre suggéré
      const suggestedTitle = this.generateTitle(category, mainIssue, callContext);

      return {
        callId: transcription.callId,
        summary,
        mainIssue,
        customerSentiment: sentiment,
        actionItems,
        category,
        priority,
        suggestedTitle,
        keywords,
        confidence: transcription.confidence,
        recordingUrl: callContext.recordingUrl
      };
    } catch (error) {
      this.logger.error('Analysis failed:', error);
      return this.getFallbackAnalysis(transcription);
    }
  }

  private extractMainIssue(text: string): string {
    // Patterns pour identifier le problème principal
    const issuePatterns = [
      /problème avec (.+?)(?:\.|,|$)/i,
      /ne fonctionne pas (.+?)(?:\.|,|$)/i,
      /erreur (?:de |lors de |avec )(.+?)(?:\.|,|$)/i,
      /impossible de (.+?)(?:\.|,|$)/i,
      /(.+?) ne marche pas/i,
      /bug (?:dans |avec |sur )(.+?)(?:\.|,|$)/i
    ];

    for (const pattern of issuePatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }

    // Fallback: première phrase interrogative ou exclamative
    const sentences = text.split(/[.!?]+/);
    const problemSentence = sentences.find(s => 
      s.includes('problème') || 
      s.includes('erreur') || 
      s.includes('bug') ||
      s.includes('ne fonctionne pas')
    );

    return problemSentence?.trim() || 'Problème non spécifié';
  }

  private analyzeSentiment(text: string): 'positive' | 'neutral' | 'negative' {
    // Mots indicateurs de sentiment
    const positiveWords = [
      'merci', 'parfait', 'excellent', 'super', 'génial', 'bien',
      'satisfait', 'content', 'heureux', 'formidable', 'agréable'
    ];

    const negativeWords = [
      'problème', 'bug', 'erreur', 'lent', 'impossible', 'urgent',
      'frustré', 'énervé', 'déçu', 'catastrophe', 'horrible',
      'nul', 'mauvais', 'insatisfait', 'mécontent'
    ];

    const exclamations = (text.match(/!/g) || []).length;
    const questions = (text.match(/\?/g) || []).length;

    let positiveScore = 0;
    let negativeScore = 0;

    // Compter les mots positifs/négatifs
    positiveWords.forEach(word => {
      const count = (text.match(new RegExp(word, 'gi')) || []).length;
      positiveScore += count;
    });

    negativeWords.forEach(word => {
      const count = (text.match(new RegExp(word, 'gi')) || []).length;
      negativeScore += count;
    });

    // Les exclamations augmentent l'intensité
    negativeScore += exclamations * 0.5;

    // Déterminer le sentiment
    if (negativeScore > positiveScore * 1.5) {
      return 'negative';
    } else if (positiveScore > negativeScore * 1.5) {
      return 'positive';
    }
    
    return 'neutral';
  }

  private extractActionItems(text: string): string[] {
    const actionPatterns = [
      /il faut (.+?)(?:\.|,|$)/gi,
      /pourriez-vous (.+?)(?:\.|,|$)/gi,
      /pouvez-vous (.+?)(?:\.|,|$)/gi,
      /besoin de (.+?)(?:\.|,|$)/gi,
      /nécessaire de (.+?)(?:\.|,|$)/gi,
      /vérifier (.+?)(?:\.|,|$)/gi,
      /installer (.+?)(?:\.|,|$)/gi,
      /configurer (.+?)(?:\.|,|$)/gi,
      /mettre à jour (.+?)(?:\.|,|$)/gi,
      /résoudre (.+?)(?:\.|,|$)/gi
    ];

    const actions = new Set<string>();

    for (const pattern of actionPatterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          actions.add(match[1].trim());
        }
      }
    }

    // Ajouter des actions basées sur les mots-clés
    if (text.includes('redémarrer') || text.includes('restart')) {
      actions.add('Redémarrer le système ou l\'application');
    }
    if (text.includes('mot de passe')) {
      actions.add('Réinitialiser ou vérifier le mot de passe');
    }
    if (text.includes('mise à jour') || text.includes('update')) {
      actions.add('Vérifier et installer les mises à jour');
    }

    return Array.from(actions).slice(0, 5);
  }

  private categorizeCall(text: string): string {
    const categories = {
      'Technique': [
        'bug', 'erreur', 'problème', 'lent', 'crash', 'freeze',
        'ne fonctionne pas', 'connexion', 'réseau', 'logiciel',
        'application', 'système', 'ordinateur', 'serveur'
      ],
      'Facturation': [
        'facture', 'paiement', 'prix', 'coût', 'abonnement',
        'remboursement', 'tarif', 'devis', 'compte', 'solde'
      ],
      'Compte': [
        'mot de passe', 'identifiant', 'login', 'accès', 'compte',
        'utilisateur', 'profil', 'permission', 'droits'
      ],
      'Information': [
        'comment', 'information', 'question', 'savoir', 'comprendre',
        'expliquer', 'aide', 'tutoriel', 'guide', 'documentation'
      ],
      'Installation': [
        'installer', 'installation', 'configurer', 'configuration',
        'paramétrer', 'setup', 'déployer', 'mise en place'
      ]
    };

    let maxScore = 0;
    let bestCategory = 'Autre';

    for (const [category, keywords] of Object.entries(categories)) {
      let score = 0;
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          score++;
        }
      });

      if (score > maxScore) {
        maxScore = score;
        bestCategory = category;
      }
    }

    return bestCategory;
  }

  private determinePriority(
    text: string,
    sentiment: string
  ): 'low' | 'normal' | 'high' | 'urgent' {
    // Mots-clés d'urgence
    const urgentKeywords = ['urgent', 'critique', 'bloqué', 'arrêté', 'impossible'];
    const highKeywords = ['important', 'rapidement', 'au plus vite', 'problème majeur'];
    const lowKeywords = ['mineur', 'question', 'information', 'quand vous pourrez'];

    // Vérifier l'urgence
    if (urgentKeywords.some(keyword => text.includes(keyword))) {
      return 'urgent';
    }

    if (highKeywords.some(keyword => text.includes(keyword)) || sentiment === 'negative') {
      return 'high';
    }

    if (lowKeywords.some(keyword => text.includes(keyword))) {
      return 'low';
    }

    return 'normal';
  }

  private generateSummary(transcription: Transcription): string {
    // Prendre les 3 premières phrases significatives
    const sentences = transcription.text
      .split(/[.!?]+/)
      .filter(s => s.trim().length > 20)
      .slice(0, 3);

    if (sentences.length === 0) {
      return transcription.text.substring(0, 200);
    }

    return sentences.join('. ').substring(0, 200);
  }

  private generateTitle(category: string, issue: string, context: any): string {
    const caller = context.caller || 'Client';
    const truncatedIssue = issue.substring(0, 50);
    
    return `${category} - ${truncatedIssue} - ${caller}`;
  }

  private getFallbackAnalysis(transcription: Transcription): CallAnalysis {
    return {
      callId: transcription.callId,
      summary: 'Appel client nécessitant analyse',
      mainIssue: 'À déterminer',
      customerSentiment: 'neutral',
      actionItems: ['Analyser la demande du client', 'Fournir une solution appropriée'],
      category: 'Autre',
      priority: 'normal',
      suggestedTitle: 'Support client - Appel à qualifier',
      keywords: [],
      confidence: 0.5
    };
  }
}

export default new AnalysisLocalService();