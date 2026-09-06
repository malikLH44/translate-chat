# Kafka Translate Chat — Bloc 1 : Infra de base

## Démarrer

```bash
cp .env.example .env
docker compose up -d
docker compose ps
```

Tous les services doivent passer en `healthy` ou `running` (laisse 30-60s à Kafka et LibreTranslate pour démarrer, LibreTranslate télécharge des modèles de langue au premier lancement).

## Vérifications à faire

### 1. Kafka fonctionne
Ouvre l'UI Kafka dans ton navigateur : http://localhost:8080
Tu dois voir le cluster "local" connecté, avec 0 topic pour l'instant (normal, on les créera au Bloc 3).

Ou en ligne de commande :
```bash
docker exec kafka kafka-topics.sh --bootstrap-server localhost:9092 --list
```
Ne doit pas renvoyer d'erreur (même si la liste est vide).

### 2. Postgres fonctionne et les tables existent
```bash
docker exec -it postgres psql -U app_user -d chatdb -c "\dt"
```
Tu dois voir les tables `users`, `conversations`, `messages`.

### 3. Redis fonctionne
```bash
docker exec -it redis redis-cli ping
```
Doit répondre `PONG`.

### 4. LibreTranslate fonctionne
```bash
curl -X POST http://localhost:5000/translate \
  -H "Content-Type: application/json" \
  -d '{"q": "Bonjour, comment allez-vous ?", "source": "fr", "target": "es"}'
```
Doit renvoyer un JSON avec le texte traduit en espagnol, par exemple :
```json
{"translatedText":"Hola, ¿cómo estás?"}
```

Tu peux aussi tester dans le navigateur : http://localhost:5000

## Une fois que les 4 vérifications passent

L'infra de base est validée, on passe au Bloc 2 (Auth Service).

## Arrêter

```bash
docker compose down        # garde les données (volumes)
docker compose down -v     # supprime aussi les données
```
