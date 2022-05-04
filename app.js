// packages fs et http fournis par node
const fs = require('fs');
const http = require('https');
const nodemailer = require('nodemailer');

// définition des constantes utilisées par l'application
const smoothcompHost = 'smoothcomp.com';
const smoothcompPath = '/en/event/7144/participants';
const personnesNotifiees = ['antoine.gautrain@gmail.com'];

// définition / initialisation des variables
let ancienNombreDinscrits = 0, nouveauNombreDinscrits = 0;
let historiqueRecuperations = [];

// récuperation de l'ancien nombre d'inscrits à la compétition (base de données, ou un fichier plat .txt par exemple)
// en l'occurrence on stocke ça dans un fichier .txt au format JSON
const fichierContenantLeNombreDinscrits = 'resultat.txt';
fs.readFile(fichierContenantLeNombreDinscrits, 'utf8', (err, contenu) => {
  if (err) throw err;

  if (contenu) {

    // convertit le contenu du fichier (du texte) en JSON
    historiqueRecuperations = JSON.parse(contenu);

    if (historiqueRecuperations?.length) {
      const derniereRecuperation = historiqueRecuperations[historiqueRecuperations.length - 1];
      ancienNombreDinscrits = parseInt(derniereRecuperation.inscrits, 10);
      console.info('Dernier nombre d\'inscrits:', ancienNombreDinscrits, '|', new Date(derniereRecuperation.date).toLocaleString('fr-FR'));
    }
  }
});

// Envoi d'une requête pour récupérer le contenu de la page smoothcomp.com/en/event/7144/participants
http.get({
  hostname: smoothcompHost,
  port: 443, // port 443 = HTTPS, port 80 pour HTTP
  path: smoothcompPath,
  agent: false
}, (res) => {

  // la fonction suivante sera exécutée à chaque fois que l'on reçoit des parties de la page
  // comme celle-ci peut-être volumineuse on ne récupère pas forcément tout d'un coup
  res.on('data', function (code) {

      // recherche du nombre d'inscrits avec une REGEX
      const regexForRegistrationsCount = new RegExp('<span class="badge hidden-xs">([0-9]*)<\/span>');

      // correspondances ?
      const matches = code.toString().match(regexForRegistrationsCount);
      if (matches?.length >= 2 && matches[1]) {
        const nouveauNombreDinscrits = matches[1];

        // on mémorise les inscrits trouvés
        historiqueRecuperations.push({
          inscrits: parseInt(nouveauNombreDinscrits, 10),
          date: Date.now()
        });

        console.info('Mise à jour du nombre d\'inscrits:', nouveauNombreDinscrits, '|', new Date(Date.now()).toLocaleString('fr-FR'));

        // écriture du nouveau nombre d'inscrits dans le fichier texte
        fs.writeFile(fichierContenantLeNombreDinscrits, JSON.stringify(historiqueRecuperations), 'utf8', (err) => {
          if (err) throw err;
        });


        if (nouveauNombreDinscrits - ancienNombreDinscrits > 0) {
          console.info('Nouveau nombre d\'inscrits:', nouveauNombreDinscrits - ancienNombreDinscrits);
          // si nouveaux inscrits à la compétition => envoi d'un email aux personnes à notifier
          envoiMailGroupe(nouveauNombreDinscrits - ancienNombreDinscrits);
        } else {
          console.info('Aucun nouvel inscrit');
        }
      }

  });

});

// fonction d'envoi d'un mail en se connectant à un compte Gmail grâce à nodemailer
// DEPRECATED: Gmail arrêtera de permettre l'envoi automatique de mail au 30 Mai 2022
function envoiMailGroupe(inscriptions) {
  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: {
      user: 'XXXXXX@gmail.com',
      pass: ''
    }
  });

  const mailOptions = {
    from: '"Smoothcomp - Antoine" <antoine.gautrain@gmail.com', // sender address
    to: personnesNotifiees.join(', '), // list of receivers
    subject: 'Nouveaux inscrits', // Subject line
    text: 'Il semblerait qu\'il y ait ' + inscriptions + ' nouvelles inscriptions, sur la page ' + smoothcompHost + smoothcompPath, // plaintext body
    html: 'Il semblerait qu\'il y ait <b>' + inscriptions + ' nouvelles inscriptions</b>, sur la page <a href="' + smoothcompHost + smoothcompPath + '">' + smoothcompHost + smoothcompPath + '</a>' // html body
  };

  transporter.sendMail(mailOptions, (err, info) => {
    if (err) console.error(err);
    console.info(info);
  });

}
