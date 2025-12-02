pipeline {
    agent any
    tools {
        jdk 'jdk17'
        nodejs 'node18'
    }
    environment {
        SCANNER_HOME = tool 'sonar-scanner'
        KUBE_CONFIG = credentials('kubeconfig')
        DOCKER_IMAGE = 'skan07/chatbot-openai:latest'
    }
    stages {
        stage ("Clean Workspace") {
            steps {
                cleanWs()
            }
        }
        
        stage ("Git Checkout") {
            steps {
                git branch: 'main', 
                url: 'https://github.com/Skaanzz/ChatBot-OpenAI.git',
                credentialsId: 'github-credentials'
            }
        }
        
        stage("SonarQube Analysis") {
            steps {
                withSonarQubeEnv('sonar-server') {
                    sh '''$SCANNER_HOME/bin/sonar-scanner \
                    -Dsonar.projectName=chatbot-openai \
                    -Dsonar.projectKey=chatbot-openai'''
                }
            }
        }
        
        stage("Quality Gate") {
            steps {
                script {
                    waitForQualityGate abortPipeline: false, credentialsId: 'Sonar-token'
                }
            }
        }
        
        stage("Install NPM Dependencies") {
            steps {
                dir('api') {
                    sh "npm ci --omit=dev"
                }
            }
        }
        
        stage('OWASP FS SCAN') {
            steps {
                dependencyCheck additionalArguments: '--scan ./ --disableYarnAudit --disableNodeAudit', odcInstallation: 'DP-Check'
                dependencyCheckPublisher pattern: '**/dependency-check-report.xml'
            }
        }
        
        stage ("Trivy File Scan") {
            steps {
                sh "trivy fs . > trivy.txt"
            }
        }
        
        stage ("Build Docker Image") {
            steps {
                script {
                    sh "docker build -t ${DOCKER_IMAGE} ."
                }
            }
        }
        
        stage ("Tag & Push to DockerHub") {
            steps {
                script {
                    withDockerRegistry(credentialsId: 'docker') {
                        sh "docker tag ${DOCKER_IMAGE} ${DOCKER_IMAGE}"
                        sh "docker push ${DOCKER_IMAGE}"
                    }
                }
            }
        }
        
        stage('Generate Kubernetes Manifests') {
            steps {
                script {
                    // Create deployment.yaml
                    writeFile file: 'deployment.yaml', text: """
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chatbot-openai
spec:
  replicas: 2
  selector:
    matchLabels:
      app: chatbot-openai
  template:
    metadata:
      labels:
        app: chatbot-openai
    spec:
      imagePullSecrets:
      - name: regcred
      containers:
      - name: chatbot-openai
        image: ${DOCKER_IMAGE}
        ports:
        - containerPort: 3000
        env:
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: chatbot-secrets
              key: openai-api-key
        resources:
          limits:
            cpu: "500m"
            memory: "512Mi"
"""
                    // Create service.yaml
                    writeFile file: 'service.yaml', text: """
apiVersion: v1
kind: Service
metadata:
  name: chatbot-openai-service
spec:
  type: NodePort
  selector:
    app: chatbot-openai
  ports:
    - protocol: TCP
      port: 80
      targetPort: 3000
"""
                }
            }
        }
        
        stage('Deploy to Kubernetes') {
            steps {
                script {
                    withCredentials([
                        file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG_FILE'),
                        usernamePassword(
                            credentialsId: 'docker',
                            usernameVariable: 'DOCKER_USER',
                            passwordVariable: 'DOCKER_PASS'
                        )
                    ]) {
                        sh '''
                            mkdir -p ${WORKSPACE}/.kube
                            cp "${KUBECONFIG_FILE}" ${WORKSPACE}/.kube/config
                            chmod 600 ${WORKSPACE}/.kube/config
                            export KUBECONFIG=${WORKSPACE}/.kube/config
                            
                            # Create Docker registry secret if not exists
                            kubectl create secret docker-registry regcred \
                                --docker-server=docker.io \
                                --docker-username=${DOCKER_USER} \
                                --docker-password=${DOCKER_PASS} \
                                --dry-run=client -o yaml | kubectl apply -f -

                            # Create OpenAI API key secret if not exists
                            kubectl create secret generic chatbot-secrets \
                                --from-literal=openai-api-key=${OPENAI_API_KEY} \
                                --dry-run=client -o yaml | kubectl apply -f -

                            # Apply Kubernetes manifests
                            kubectl apply -f deployment.yaml
                            kubectl apply -f service.yaml
                            
                            # Verify deployment
                            kubectl rollout status deployment/chatbot-openai --timeout=5m || true
                            kubectl get pods -o wide
                            kubectl describe deployment chatbot-openai
                        '''
                    }
                }
            }
        }
    }
    
    post {
        always {
            // Clean up workspace after build
            cleanWs()
        }
    }
}
