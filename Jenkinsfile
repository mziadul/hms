pipeline {
    agent any

    tools {
        // This must match the name you gave in Manage Jenkins -> Tools
        nodejs 'node24'
    }

    stages {
        stage('Checkout') {
            steps {
                // Jenkins will automatically pull code from the branch you specify later
                checkout scm
            }
        }

        stage('Install Dependencies') {
            steps {
                echo 'Installing packages...'
                sh 'npm install'
            }
        }

        stage('Lint & Type Check') {
            steps {
                echo 'Skipping lint check...'
            }
        }

        stage('Build Next.js App') {
            steps {
                echo 'Building the project...'
                sh 'npm run build'
            }
        }

        stage('Deploy with PM2') {
            steps {
                echo 'Ensuring PM2 is installed and starting app...'
                // Check if pm2 exists, if not, install it
                sh 'command -v pm2 >/dev/null 2>&1 || npm install -g pm2'
                
                sh 'pm2 delete nextjs-app || true'
                sh 'pm2 start npm --name "nextjs-app" -- start'
            }
        }
    }

    post {
        success {
            echo 'Pipeline completed successfully!'
        }
        failure {
            echo 'Pipeline failed. Check the logs.'
        }
    }
}