#!/bin/bash

MODEL=${WHISPER_MODEL:-base}
MODEL_DIR="./whisper-models"

echo "Téléchargement du modèle Whisper: $MODEL"

# Créer le répertoire des modèles
mkdir -p "$MODEL_DIR"

# URLs des modèles
declare -A MODEL_URLS=(
  ["tiny"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.bin"
  ["base"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin"
  ["small"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-small.bin"
  ["medium"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-medium.bin"
  ["large"]="https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3.bin"
)

# Vérifier si le modèle existe
if [[ ! ${MODEL_URLS[$MODEL]+_} ]]; then
  echo "Modèle invalide: $MODEL"
  echo "Modèles disponibles: tiny, base, small, medium, large"
  exit 1
fi

MODEL_FILE="$MODEL_DIR/ggml-$MODEL.bin"

# Vérifier si le modèle est déjà téléchargé
if [ -f "$MODEL_FILE" ]; then
  echo "Le modèle $MODEL est déjà téléchargé"
  exit 0
fi

# Télécharger le modèle
echo "Téléchargement en cours..."
wget -c "${MODEL_URLS[$MODEL]}" -O "$MODEL_FILE"

if [ $? -eq 0 ]; then
  echo "Modèle $MODEL téléchargé avec succès!"
else
  echo "Erreur lors du téléchargement du modèle"
  rm -f "$MODEL_FILE"
  exit 1
fi