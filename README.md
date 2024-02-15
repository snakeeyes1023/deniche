# Deniche 🚀

🏠 Remax - Web Scrapping Alert 💰⏰

## Prérequis

Assurez-vous d'avoir [Node.js](https://nodejs.org/) installé sur votre machine.

## Installation

1. Clonez le dépôt :

```bash
git clone https://github.com/snakeeyes1023/deniche.git
```

2. Accédez au répertoire du projet :

```bash
cd deniche
```

3. Installez les dépendances :

```bash
npm install
```

4. Créez un fichier .env à la racine du projet et ajoutez les variables d'environnement suivantes :

```bash
# .env
REMAX_URL='https://www.remax-quebec.com/en/results?ForSale=1&Municipalites=%5B32033,32045,32040,39042,32023,32072%5D'
```

## Utilisation

1. Lancez le programme :

```bash
npm start
```

Les résultats seront affichés dans le dossier /output/extract.
Libre à vous de modifier `/src/index.ts` `(func notifyChange)` pour mettre en place des notifications, etc.

## 🚸 Attention

Ce programme est à titre éducatif et ne doit pas être utilisé pour des fins commerciales. Il est important de respecter les conditions d'utilisation des sites web que vous scrapez.

## License

[MIT](https://choosealicense.com/licenses/mit/)
